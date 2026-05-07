import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AlphaMode } from '../../shared/formats';
import {
  ensureBinaryAvailable,
  resolveDatArchPath,
  resolveDatModelsDir,
  resolveDatVendorDir,
  resolveBundledPythonBinary,
} from './binaries';
import { hasNvidiaGpu } from './gpu-detection';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import { getImageFilesFromFolder } from './discovery';
import { spawnManaged } from './job-runtime';
import type { JobEmitter } from './types';

const DAT_SCALES = [2, 3, 4] as const;
const DAT_MODEL_FILES: Record<(typeof DAT_SCALES)[number], string> = {
  2: 'DAT_x2.pth',
  3: 'DAT_x3.pth',
  4: 'DAT_x4.pth',
};
const DAT_TILE_SIZE = 400;
const DAT_TILE_OVERLAP = 32;
const DAT_MEMORY_ERROR_PATTERNS = [
  'out of memory',
  'not enough memory',
  'resource exhausted',
  'video memory',
  'could not allocate tensor',
] as const;
const DAT_ALWAYS_CHOP_DEVICE_TYPES = ['privateuseone'] as const;
const DAT_RUNTIME_MODES = ['auto', 'cpu', 'directml'] as const;

type PythonCommand = {
  command: string;
  argsPrefix: string[];
  label: string;
  runtimeMode: 'auto' | 'cpu' | 'directml';
};

let cachedPythonCommandPromise: Promise<PythonCommand> | null = null;
let cachedDependencyCheckPromise: Promise<void> | null = null;

export function isDatMemoryRelatedErrorMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return DAT_MEMORY_ERROR_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
}

export function shouldDatPreferChopInference(deviceType: string): boolean {
  return DAT_ALWAYS_CHOP_DEVICE_TYPES.includes(
    deviceType as (typeof DAT_ALWAYS_CHOP_DEVICE_TYPES)[number]
  );
}

export function normalizeDatRuntimeMode(value: string | undefined): (typeof DAT_RUNTIME_MODES)[number] {
  const normalizedValue = value?.trim().toLowerCase();
  return DAT_RUNTIME_MODES.includes(normalizedValue as (typeof DAT_RUNTIME_MODES)[number])
    ? (normalizedValue as (typeof DAT_RUNTIME_MODES)[number])
    : 'auto';
}

export async function ensureDatAvailable(): Promise<void> {
  const vendorDir = resolveDatVendorDir();
  const modelsDir = resolveDatModelsDir();
  const archPath = resolveDatArchPath();

  if (!vendorDir) {
    throw new Error('DAT vendor directory could not be resolved.');
  }
  if (!modelsDir) {
    throw new Error('DAT models directory could not be resolved.');
  }
  if (!archPath) {
    throw new Error('DAT architecture path could not be resolved.');
  }

  await ensureBinaryAvailable(archPath, 'DAT architecture definition');
  await Promise.all(DAT_SCALES.map((scale) => access(join(modelsDir, DAT_MODEL_FILES[scale]))));

  const python = await resolvePythonCommand();
  await ensureDatDependencies(python);
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  preserveAlpha?: boolean;
  alphaMode?: AlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  if (!DAT_SCALES.includes(options.scale as (typeof DAT_SCALES)[number])) {
    throw new Error(`Unsupported DAT scale: ${options.scale}.`);
  }

  await ensureDatAvailable();
  await mkdir(options.outputDir, { recursive: true });

  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: (inputDir, outputDir) =>
        runDatDirectory(inputDir, outputDir, options.scale, options.emitter),
    });
    return;
  }

  await runDatDirectory(options.inputDir, options.outputDir, options.scale, options.emitter);
}

async function runDatDirectory(
  inputDir: string,
  outputDir: string,
  scale: number,
  emitter: JobEmitter
): Promise<void> {
  const python = await resolvePythonCommand();
  const vendorDir = resolveDatVendorDir();
  const modelsDir = resolveDatModelsDir();
  const archPath = resolveDatArchPath();
  const runnerTempDir = await mkdtemp(join(tmpdir(), 'sst-dat-runner-'));
  const runnerPath = join(runnerTempDir, 'dat_runner.py');

  try {
    await writeFile(runnerPath, DAT_RUNNER_SCRIPT, 'utf8');
    await runDat(
      python,
      [
        runnerPath,
        '--input-dir',
        inputDir,
        '--output-dir',
        outputDir,
        '--scale',
        String(scale),
        '--vendor-dir',
        vendorDir,
        '--arch-path',
        archPath,
        '--model-path',
        join(modelsDir, DAT_MODEL_FILES[scale as keyof typeof DAT_MODEL_FILES]),
        '--tile',
        String(DAT_TILE_SIZE),
        '--tile-overlap',
        String(DAT_TILE_OVERLAP),
      ],
      emitter
    );

    const outputPaths = await getImageFilesFromFolder(outputDir);
    if (outputPaths.length === 0) {
      throw new Error('DAT did not write any output images.');
    }
  } finally {
    await rm(runnerTempDir, { recursive: true, force: true });
  }
}

async function resolvePythonCommand(): Promise<PythonCommand> {
  if (!cachedPythonCommandPromise) {
    cachedPythonCommandPromise = detectPythonCommand();
  }

  return cachedPythonCommandPromise;
}

async function detectPythonCommand(): Promise<PythonCommand> {
  for (const candidate of await getBundledPythonCandidates()) {
    if (await canRunPython(candidate)) {
      return candidate;
    }
  }

  const candidates: PythonCommand[] =
    process.platform === 'win32'
      ? [
          { command: 'py', argsPrefix: ['-3.11'], label: 'py -3.11', runtimeMode: 'auto' },
          { command: 'python3.11', argsPrefix: [], label: 'python3.11', runtimeMode: 'auto' },
        ]
      : [{ command: 'python3.11', argsPrefix: [], label: 'python3.11', runtimeMode: 'auto' }];

  for (const candidate of candidates) {
    const ok = await canRunPython(candidate);
    if (ok) {
      return candidate;
    }
  }

  throw new Error(
    'DAT could not start its bundled Python 3.11 runtime. Ensure the packaged runtime is present. For development, you can also provide an external "python3.11" or "py -3.11" command.'
  );
}

async function getBundledPythonCandidates(): Promise<PythonCommand[]> {
  const cpuPython = resolveBundledPythonBinary('cpu');
  const cudaPython = resolveBundledPythonBinary('cuda');
  const directmlPython = resolveBundledPythonBinary('directml');
  const candidates: PythonCommand[] = [];
  const pushCandidate = (
    command: string,
    label: string,
    runtimeMode: PythonCommand['runtimeMode']
  ): void => {
    if (!command || candidates.some((candidate) => candidate.command === command)) {
      return;
    }

    candidates.push({ command, argsPrefix: [], label, runtimeMode });
  };

  if (process.platform === 'win32') {
    if (await hasNvidiaGpu()) {
      pushCandidate(cudaPython, `${cudaPython} (bundled cuda)`, 'auto');
      pushCandidate(cpuPython, `${cpuPython} (bundled cpu fallback)`, 'cpu');
      pushCandidate(directmlPython, `${directmlPython} (bundled directml fallback)`, 'directml');
    } else {
      pushCandidate(cpuPython, `${cpuPython} (bundled cpu)`, 'cpu');
      pushCandidate(directmlPython, `${directmlPython} (bundled directml fallback)`, 'directml');
      pushCandidate(cudaPython, `${cudaPython} (bundled cuda fallback)`, 'auto');
    }
    return candidates;
  }

  pushCandidate(cpuPython, `${cpuPython} (bundled cpu)`, 'cpu');
  pushCandidate(cudaPython, `${cudaPython} (bundled cuda fallback)`, 'auto');
  return candidates;
}

async function canRunPython(python: PythonCommand): Promise<boolean> {
  try {
    await runProcess(python.command, [
      ...python.argsPrefix,
      '-c',
      'import sys; sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)',
    ]);
    return true;
  } catch {
    return false;
  }
}

async function ensureDatDependencies(python: PythonCommand): Promise<void> {
  if (!cachedDependencyCheckPromise) {
    cachedDependencyCheckPromise = runProcess(python.command, [
      ...python.argsPrefix,
      '-c',
      [
        'import importlib.util, sys',
        "required = ['torch', 'cv2', 'numpy', 'timm', 'einops']",
        'missing = [name for name in required if importlib.util.find_spec(name) is None]',
        'sys.exit(1 if missing else 0)',
      ].join('; '),
    ]).catch(() => {
      throw new Error(
        `DAT could not verify its Python dependencies in the selected runtime (${python.label}). ` +
        'The bundled runtime may be missing or incomplete.'
      );
    });
  }

  await cachedDependencyCheckPromise;
}

async function runDat(python: PythonCommand, args: string[], emitter: JobEmitter): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnManaged(python.command, [...python.argsPrefix, ...args], {
      windowsHide: true,
      env: {
        ...process.env,
        SST_DAT_RUNTIME: python.runtimeMode,
      },
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

        if (level === 'error' || /error|failed|traceback|runtimeerror|modulenotfound/i.test(line)) {
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
        new Error(outputTail.slice(-12).join(' | ') || `DAT exited with code ${code ?? 'unknown'}.`)
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

const DAT_RUNNER_SCRIPT = String.raw`import argparse
import glob
import importlib.util
import os
import sys
import types

import cv2
import numpy as np
import torch

MEMORY_ERROR_PATTERNS = ${JSON.stringify(DAT_MEMORY_ERROR_PATTERNS)}
ALWAYS_CHOP_DEVICE_TYPES = ${JSON.stringify(DAT_ALWAYS_CHOP_DEVICE_TYPES)}
DAT_RUNTIME_MODES = ${JSON.stringify(DAT_RUNTIME_MODES)}


class DummyRegistry:
    def __init__(self):
        self._items = {}

    def register(self, obj=None):
        if obj is None:
            def deco(func_or_class):
                self._items[func_or_class.__name__] = func_or_class
                return func_or_class

            return deco

        self._items[obj.__name__] = obj
        return obj


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--scale', required=True, type=int)
    parser.add_argument('--vendor-dir', required=True)
    parser.add_argument('--arch-path', required=True)
    parser.add_argument('--model-path', required=True)
    parser.add_argument('--tile', type=int, default=400)
    parser.add_argument('--tile-overlap', type=int, default=32)
    return parser.parse_args()


def get_device():
    runtime_mode = os.environ.get('SST_DAT_RUNTIME', 'auto').strip().lower()
    if runtime_mode not in DAT_RUNTIME_MODES:
        runtime_mode = 'auto'

    print(f'[DAT] Runtime mode: {runtime_mode}', flush=True)
    print(f'[DAT] Python: {sys.version}', flush=True)
    print(f'[DAT] Torch: {torch.__version__}', flush=True)
    print(f'[DAT] CUDA available: {torch.cuda.is_available()}', flush=True)
    print(f'[DAT] CUDA version: {torch.version.cuda}', flush=True)

    if runtime_mode != 'cpu' and torch.cuda.is_available():
        device = torch.device('cuda')
        print(f'[DAT] Using GPU: {torch.cuda.get_device_name(0)}', flush=True)
        return device

    if runtime_mode == 'directml':
        try:
            import torch_directml
            device = torch_directml.device()
            print(f'[DAT] Using DirectML device: {torch_directml.device_name(0)}', flush=True)
            return device
        except ImportError:
            print('[DAT] DirectML runtime requested but torch_directml is unavailable.', flush=True)

    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        print('[DAT] Using Apple MPS device.', flush=True)
        return torch.device('mps')

    if runtime_mode == 'auto':
        print('[DAT] Falling back to CPU. DirectML is disabled by default for DAT stability.', flush=True)
    else:
        print('[DAT] No GPU found, falling back to CPU.', flush=True)
    return torch.device('cpu')

def load_dat_class(arch_path):
    basicsr_module = types.ModuleType('basicsr')
    utils_module = types.ModuleType('basicsr.utils')
    registry_module = types.ModuleType('basicsr.utils.registry')
    registry_module.ARCH_REGISTRY = DummyRegistry()

    sys.modules['basicsr'] = basicsr_module
    sys.modules['basicsr.utils'] = utils_module
    sys.modules['basicsr.utils.registry'] = registry_module

    spec = importlib.util.spec_from_file_location('dat_arch_runtime', arch_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module.DAT


def define_model(scale, arch_path, model_path):
    DATNet = load_dat_class(arch_path)
    model = DATNet(
        upscale=scale,
        in_chans=3,
        img_size=64,
        img_range=1.0,
        split_size=[8, 32],
        depth=[6, 6, 6, 6, 6, 6],
        embed_dim=180,
        num_heads=[6, 6, 6, 6, 6, 6],
        expansion_factor=4,
        resi_connection='1conv',
    )

    pretrained_model = torch.load(model_path, map_location='cpu')
    if isinstance(pretrained_model, dict):
        if 'params' in pretrained_model:
            pretrained_model = pretrained_model['params']
        elif 'params_ema' in pretrained_model:
            pretrained_model = pretrained_model['params_ema']
        elif 'state_dict' in pretrained_model:
            pretrained_model = pretrained_model['state_dict']

    model.load_state_dict(pretrained_model, strict=True)
    return model


def forward_chop(img_lq, model, scale, shave, min_size):
    b, c, h, w = img_lq.size()
    h_half, w_half = h // 2, w // 2
    h_size, w_size = min(h_half + shave, h), min(w_half + shave, w)

    input_patches = [
        img_lq[..., 0:h_size, 0:w_size],
        img_lq[..., 0:h_size, w - w_size:w],
        img_lq[..., h - h_size:h, 0:w_size],
        img_lq[..., h - h_size:h, w - w_size:w],
    ]

    if h_size * w_size <= min_size:
        output_patches = [model(patch) for patch in input_patches]
    else:
        output_patches = [
            forward_chop(patch, model, scale, shave, min_size) for patch in input_patches
        ]

    h *= scale
    w *= scale
    h_half *= scale
    w_half *= scale
    h_size *= scale
    w_size *= scale

    output = img_lq.new_zeros(b, c, h, w)
    output[..., 0:h_half, 0:w_half] = output_patches[0][..., 0:h_half, 0:w_half]
    output[..., 0:h_half, w_half:w] = output_patches[1][..., 0:h_half, w_size - (w - w_half):w_size]
    output[..., h_half:h, 0:w_half] = output_patches[2][..., h_size - (h - h_half):h_size, 0:w_half]
    output[..., h_half:h, w_half:w] = output_patches[3][
        ..., h_size - (h - h_half):h_size, w_size - (w - w_half):w_size
    ]
    return output


def run_inference(img_lq, model, scale, tile, tile_overlap, device):
    device_type = getattr(device, 'type', str(device).split(':')[0])
    if device_type in ALWAYS_CHOP_DEVICE_TYPES:
        print(f'[DAT] Using chop inference immediately for device type: {device_type}', flush=True)
        min_patch = max(tile, 64)
        shave = max(tile_overlap, 16)
        return forward_chop(img_lq, model, scale, shave, min_patch * min_patch)

    try:
        return model(img_lq)
    except RuntimeError as error:
        error_message = str(error).lower()
        memory_related = any(pattern in error_message for pattern in MEMORY_ERROR_PATTERNS)
        if not memory_related:
            raise

        if device.type == 'cuda':
            torch.cuda.empty_cache()

        print('[DAT] Falling back to chop inference.', flush=True)
        min_patch = max(tile, 64)
        shave = max(tile_overlap, 16)
        return forward_chop(img_lq, model, scale, shave, min_patch * min_patch)


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    device = get_device()
    model = define_model(args.scale, args.arch_path, args.model_path)
    model.eval()
    model = model.to(device)

    input_paths = sorted(glob.glob(os.path.join(args.input_dir, '*')))
    if not input_paths:
        raise RuntimeError('No input images were found for DAT.')

    with torch.no_grad():
        for path in input_paths:
            imgname = os.path.splitext(os.path.basename(path))[0]
            img_lq = cv2.imread(path, cv2.IMREAD_COLOR)
            if img_lq is None:
                raise RuntimeError(f'Failed to decode image: {path}')

            img_lq = img_lq.astype(np.float32) / 255.0
            img_lq = np.transpose(img_lq[:, :, [2, 1, 0]], (2, 0, 1))
            img_lq = torch.from_numpy(img_lq).float().unsqueeze(0).to(device)

            output = run_inference(img_lq, model, args.scale, args.tile, args.tile_overlap, device)
            output = output.data.squeeze().float().cpu().clamp_(0, 1).numpy()
            output = np.transpose(output[[2, 1, 0], :, :], (1, 2, 0))
            output = (output * 255.0).round().astype(np.uint8)

            output_path = os.path.join(args.output_dir, f'{imgname}.png')
            ok = cv2.imwrite(output_path, output)
            if not ok:
                raise RuntimeError(f'Failed to write output image: {output_path}')

            print(f'{os.path.basename(path)} -> {os.path.basename(output_path)}')


if __name__ == '__main__':
    main()
`;
