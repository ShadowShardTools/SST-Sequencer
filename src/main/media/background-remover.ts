import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BackgroundRemoveModel } from '../../shared/formats';
import { resolveRembgBinary } from './binaries';
import { spawnManaged } from './job-runtime';
import type { JobEmitter } from './types';

type PythonCommand = {
  kind: 'python';
  command: string;
  argsPrefix: readonly string[];
  label: string;
};

type CliCommand = {
  kind: 'cli';
  command: string;
  argsPrefix: readonly string[];
  label: string;
};

type BackgroundRemoverCommand = PythonCommand | CliCommand;
type RembgRuntimePreference = 'auto' | 'cpu' | 'gpu';

let cachedBackgroundRemoverCommandPromise: Promise<BackgroundRemoverCommand> | null = null;
let cachedDependencyCheckPromise: Promise<void> | null = null;
let cachedNvidiaGpuCheckPromise: Promise<boolean> | null = null;

export async function ensureBackgroundRemoverAvailable(): Promise<void> {
  const runner = await resolveBackgroundRemoverCommand();
  if (runner.kind === 'python') {
    await ensureBackgroundRemoverDependencies(runner);
  }
}

export async function removeBackgroundImage(options: {
  inputPath: string;
  outputPath: string;
  model: BackgroundRemoveModel;
  emitter: JobEmitter;
}): Promise<void> {
  const runner = await resolveBackgroundRemoverCommand();
  if (runner.kind === 'cli') {
    await runBackgroundRemover(
      runner.command,
      [...runner.argsPrefix, 'i', '-m', options.model, options.inputPath, options.outputPath],
      options.emitter
    );
    return;
  }

  await ensureBackgroundRemoverDependencies(runner);
  const runnerTempDir = await mkdtemp(join(tmpdir(), 'sst-rembg-runner-'));
  const runnerPath = join(runnerTempDir, 'rembg_runner.py');

  try {
    await writeFile(runnerPath, REMBG_RUNNER_SCRIPT, 'utf8');
    await runBackgroundRemover(
      runner.command,
      [
        ...runner.argsPrefix,
        runnerPath,
        '--input-path',
        options.inputPath,
        '--output-path',
        options.outputPath,
        '--model',
        options.model,
      ],
      options.emitter
    );
  } finally {
    await rm(runnerTempDir, { recursive: true, force: true });
  }
}

async function resolveBackgroundRemoverCommand(): Promise<BackgroundRemoverCommand> {
  if (!cachedBackgroundRemoverCommandPromise) {
    cachedBackgroundRemoverCommandPromise = detectBackgroundRemoverCommand();
  }

  return cachedBackgroundRemoverCommandPromise;
}

async function detectBackgroundRemoverCommand(): Promise<BackgroundRemoverCommand> {
  const runtimePreference = getRembgRuntimePreference();
  const gpuAvailable = await hasNvidiaGpu();
  const bundledGpuCli = resolveRembgBinary('gpu');
  const bundledCpuCli = resolveRembgBinary('cpu');
  const bundledCandidates = buildBundledCliCandidates(
    runtimePreference,
    gpuAvailable,
    bundledCpuCli,
    bundledGpuCli
  );
  const cliCandidates: CliCommand[] = [
    ...bundledCandidates,
    ...(process.platform === 'win32'
      ? [
          { kind: 'cli', command: 'rembg.exe', argsPrefix: [], label: 'rembg.exe' } as const,
          { kind: 'cli', command: 'rembg', argsPrefix: [], label: 'rembg' } as const,
        ]
      : [{ kind: 'cli', command: 'rembg', argsPrefix: [], label: 'rembg' } as const]),
  ];

  for (const candidate of cliCandidates) {
    const ok = await canRunCommand(candidate.command, [...candidate.argsPrefix, '--help']);
    if (ok) {
      return candidate;
    }
  }

  return detectPythonCommand();
}

function buildBundledCliCandidates(
  runtimePreference: RembgRuntimePreference,
  gpuAvailable: boolean,
  bundledCpuCli: string,
  bundledGpuCli: string
): CliCommand[] {
  const candidates: CliCommand[] = [];
  const pushCli = (command: string, label: string): void => {
    if (!command || candidates.some((candidate) => candidate.command === command)) {
      return;
    }

    candidates.push({ kind: 'cli', command, argsPrefix: [], label });
  };

  if (runtimePreference === 'gpu') {
    pushCli(bundledGpuCli, `${bundledGpuCli} (gpu)`);
    pushCli(bundledCpuCli, `${bundledCpuCli} (cpu fallback)`);
    return candidates;
  }

  if (runtimePreference === 'cpu') {
    pushCli(bundledCpuCli, `${bundledCpuCli} (cpu)`);
    pushCli(bundledGpuCli, `${bundledGpuCli} (gpu fallback)`);
    return candidates;
  }

  if (gpuAvailable) {
    pushCli(bundledGpuCli, `${bundledGpuCli} (gpu)`);
  }
  pushCli(bundledCpuCli, `${bundledCpuCli} (cpu)`);
  if (!gpuAvailable) {
    pushCli(bundledGpuCli, `${bundledGpuCli} (gpu fallback)`);
  }

  return candidates;
}

function getRembgRuntimePreference(): RembgRuntimePreference {
  const raw = process.env.SST_REMBG_RUNTIME?.trim().toLowerCase();
  if (raw === 'cpu' || raw === 'gpu') {
    return raw;
  }

  return 'auto';
}

async function hasNvidiaGpu(): Promise<boolean> {
  if (!cachedNvidiaGpuCheckPromise) {
    cachedNvidiaGpuCheckPromise = detectNvidiaGpu();
  }

  return cachedNvidiaGpuCheckPromise;
}

async function detectNvidiaGpu(): Promise<boolean> {
  const commands =
    process.platform === 'win32'
      ? [
          { command: 'nvidia-smi', args: ['-L'] },
          {
            command: join(
              process.env['ProgramW6432'] || process.env['ProgramFiles'] || 'C:\\Program Files',
              'NVIDIA Corporation',
              'NVSMI',
              'nvidia-smi.exe'
            ),
            args: ['-L'],
          },
        ]
      : [{ command: 'nvidia-smi', args: ['-L'] }];

  for (const candidate of commands) {
    if (await canRunCommand(candidate.command, candidate.args)) {
      return true;
    }
  }

  return false;
}

async function detectPythonCommand(): Promise<PythonCommand> {
  const candidates: PythonCommand[] =
    process.platform === 'win32'
      ? [
          { kind: 'python', command: 'py', argsPrefix: ['-3.11'], label: 'py -3.11' },
          { kind: 'python', command: 'python3.11', argsPrefix: [], label: 'python3.11' },
        ]
      : [{ kind: 'python', command: 'python3.11', argsPrefix: [], label: 'python3.11' }];

  for (const candidate of candidates) {
    const ok = await canRunCommand(candidate.command, [
      ...candidate.argsPrefix,
      '-c',
      'import sys; sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)',
    ]);
    if (ok) {
      return candidate;
    }
  }

  throw new Error(
    [
      'AI background removal requires either the rembg CLI or Python 3.11.',
      'Install the official rembg CLI installer, or install Python 3.11 and run:',
      '  py -3.11 -m pip install "rembg[cpu,cli]"',
    ].join('\n')
  );
}

async function canRunCommand(command: string, args: string[]): Promise<boolean> {
  try {
    await runProcess(command, args);
    return true;
  } catch {
    return false;
  }
}

async function ensureBackgroundRemoverDependencies(python: PythonCommand): Promise<void> {
  if (!cachedDependencyCheckPromise) {
    cachedDependencyCheckPromise = runProcess(python.command, [
      ...python.argsPrefix,
      '-c',
      [
        'import importlib.util, sys',
        "required = ['rembg', 'PIL', 'numpy', 'onnxruntime']",
        'missing = [name for name in required if importlib.util.find_spec(name) is None]',
        'sys.exit(1 if missing else 0)',
      ].join('; '),
    ]).catch(() => {
      throw new Error(
        [
          'AI background removal requires either the rembg CLI or Python 3.11 dependencies.',
          'Recommended:',
          '  install the official rembg CLI installer',
          'Fallback:',
          `  ${python.label} -m pip install "rembg[cpu,cli]"`,
        ].join('\n')
      );
    });
  }

  await cachedDependencyCheckPromise;
}

async function runBackgroundRemover(
  command: string,
  args: string[],
  emitter: JobEmitter
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnManaged(command, args, {
      windowsHide: true,
    });

    const outputTail: string[] = [];
    const handleChunk = (chunk: Buffer, level: 'info' | 'error'): void => {
      const text = chunk.toString('utf8');
      const lines = text.replace(/\r/g, '\n').split('\n');

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        outputTail.push(line);
        if (outputTail.length > 40) {
          outputTail.shift();
        }

        if (
          level === 'error' ||
          /error|failed|traceback|runtimeerror|modulenotfound|exception/i.test(line)
        ) {
          emitter.log(line, 'error');
        }
      }
    };

    child.stdout.on('data', (chunk: Buffer) => handleChunk(chunk, 'info'));
    child.stderr.on('data', (chunk: Buffer) => handleChunk(chunk, 'error'));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          outputTail.slice(-12).join(' | ') ||
            `Background remover exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}

async function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnManaged(command, args, {
      windowsHide: true,
      stdio: 'ignore',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
    });
  });
}

const REMBG_RUNNER_SCRIPT = String.raw`import argparse
import io

from PIL import Image
from rembg import new_session, remove


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-path', required=True)
    parser.add_argument('--output-path', required=True)
    parser.add_argument('--model', required=True)
    return parser.parse_args()


def main():
    args = parse_args()

    session = new_session(args.model)
    with open(args.input_path, 'rb') as input_file:
        input_bytes = input_file.read()

    output_bytes = remove(input_bytes, session=session)
    output_image = Image.open(io.BytesIO(output_bytes)).convert('RGBA')
    output_image.save(args.output_path, 'PNG')
    print(f'{args.input_path} -> {args.output_path}', flush=True)


if __name__ == '__main__':
    main()
`;
