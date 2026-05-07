import { EventEmitter } from 'node:events';
import type * as FsPromises from 'node:fs/promises';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof FsPromises>('node:fs/promises');
  return {
    ...actual,
    mkdtemp: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => 'D:\\tmp'),
}));

vi.mock('./binaries', () => ({
  resolveRembgBinary: vi.fn((variant: 'cpu' | 'gpu' = 'cpu') =>
    variant === 'gpu'
      ? 'D:\\vendor\\rembg\\gpu\\rembg.exe'
      : 'D:\\vendor\\rembg\\cpu\\rembg.exe'
  ),
}));

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

function createChild(options?: {
  exitCode?: number;
  stdoutLines?: string[];
  stderrLines?: string[];
  error?: Error;
}): ChildProcess {
  const child = new FakeChildProcess();

  queueMicrotask(() => {
    if (options?.error) {
      child.emit('error', options.error);
      return;
    }

    for (const line of options?.stdoutLines ?? []) {
      child.stdout.emit('data', Buffer.from(`${line}\n`, 'utf8'));
    }

    for (const line of options?.stderrLines ?? []) {
      child.stderr.emit('data', Buffer.from(`${line}\n`, 'utf8'));
    }

    child.emit('close', options?.exitCode ?? 0);
  });

  return child as unknown as ChildProcess;
}

function createEmitter() {
  return {
    started: vi.fn(),
    log: vi.fn(),
    progress: vi.fn(),
    finished: vi.fn(),
  };
}

async function loadModule() {
  return import('./background-remover');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.SST_REMBG_RUNTIME;
});

describe('background remover runtime selection', () => {
  it('prefers the bundled GPU rembg CLI when auto mode detects NVIDIA support', async () => {
    const spawnMock = vi.mocked(spawn);
    const emitter = createEmitter();
    const calls: Array<{ command: string; args: string[] }> = [];

    spawnMock.mockImplementation(
      (command: string, args: readonly string[] = [], _options?: SpawnOptions) => {
      calls.push({ command, args: [...args] });

      if (command === 'nvidia-smi' && args[0] === '-L') {
        return createChild();
      }

      if (command === 'D:\\vendor\\rembg\\gpu\\rembg.exe' && args[0] === '--help') {
        return createChild();
      }

      if (command === 'D:\\vendor\\rembg\\gpu\\rembg.exe' && args[0] === 'i') {
        return createChild({ stdoutLines: ['done'] });
      }

      return createChild({ exitCode: 1 });
      }
    );

    const { removeBackgroundImage } = await loadModule();

    await removeBackgroundImage({
      inputPath: 'D:\\input\\sprite.png',
      outputPath: 'D:\\output\\sprite.png',
      model: 'u2net',
      emitter,
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        { command: 'nvidia-smi', args: ['-L'] },
        { command: 'D:\\vendor\\rembg\\gpu\\rembg.exe', args: ['--help'] },
        {
          command: 'D:\\vendor\\rembg\\gpu\\rembg.exe',
          args: ['i', '-m', 'u2net', 'D:\\input\\sprite.png', 'D:\\output\\sprite.png'],
        },
      ])
    );
  });

  it('honors CPU override even if GPU detection succeeds', async () => {
    process.env.SST_REMBG_RUNTIME = 'cpu';

    const spawnMock = vi.mocked(spawn);
    const calls: Array<{ command: string; args: string[] }> = [];

    spawnMock.mockImplementation(
      (command: string, args: readonly string[] = [], _options?: SpawnOptions) => {
      calls.push({ command, args: [...args] });

      if (command === 'nvidia-smi' && args[0] === '-L') {
        return createChild();
      }

      if (command === 'D:\\vendor\\rembg\\cpu\\rembg.exe' && args[0] === '--help') {
        return createChild();
      }

      if (command === 'D:\\vendor\\rembg\\cpu\\rembg.exe' && args[0] === 'i') {
        return createChild();
      }

      return createChild({ exitCode: 1 });
      }
    );

    const { removeBackgroundImage } = await loadModule();

    await removeBackgroundImage({
      inputPath: 'D:\\input\\photo.png',
      outputPath: 'D:\\output\\photo.png',
      model: 'isnet-general-use',
      emitter: createEmitter(),
    });

    expect(calls[0]).toEqual({ command: 'nvidia-smi', args: ['-L'] });
    expect(calls).toEqual(
      expect.arrayContaining([
        { command: 'D:\\vendor\\rembg\\cpu\\rembg.exe', args: ['--help'] },
        {
          command: 'D:\\vendor\\rembg\\cpu\\rembg.exe',
          args: ['i', '-m', 'isnet-general-use', 'D:\\input\\photo.png', 'D:\\output\\photo.png'],
        },
      ])
    );
    expect(calls).not.toEqual(
      expect.arrayContaining([
        {
          command: 'D:\\vendor\\rembg\\gpu\\rembg.exe',
          args: ['i', '-m', 'isnet-general-use', 'D:\\input\\photo.png', 'D:\\output\\photo.png'],
        },
      ])
    );
  });

  it('falls back to Python 3.11 and cleans up the generated runner script', async () => {
    const spawnMock = vi.mocked(spawn);
    const mkdtempMock = vi.mocked(mkdtemp);
    const writeFileMock = vi.mocked(writeFile);
    const rmMock = vi.mocked(rm);

    mkdtempMock.mockResolvedValue('D:\\tmp\\sst-rembg-runner-test');
    writeFileMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);

    const calls: Array<{ command: string; args: string[] }> = [];
    spawnMock.mockImplementation(
      (command: string, args: readonly string[] = [], _options?: SpawnOptions) => {
      calls.push({ command, args: [...args] });

      if (command === 'nvidia-smi') {
        return createChild({ exitCode: 1 });
      }

      if (command.includes('nvidia-smi.exe')) {
        return createChild({ exitCode: 1 });
      }

      if (command.includes('rembg.exe') || command === 'rembg.exe' || command === 'rembg') {
        return createChild({ exitCode: 1 });
      }

      if (
        command === 'py' &&
        args[0] === '-3.11' &&
        args[1] === '-c' &&
        args[2]?.includes('sys.version_info')
      ) {
        return createChild();
      }

      if (
        command === 'py' &&
        args[0] === '-3.11' &&
        args[1] === '-c' &&
        args[2]?.includes("required = ['rembg', 'PIL', 'numpy', 'onnxruntime']")
      ) {
        return createChild();
      }

      if (
        command === 'py' &&
        args[0] === '-3.11' &&
        args[1] === 'D:\\tmp\\sst-rembg-runner-test\\rembg_runner.py'
      ) {
        return createChild({ stdoutLines: ['python-rembg-done'] });
      }

      return createChild({ exitCode: 1 });
      }
    );

    const { removeBackgroundImage } = await loadModule();

    await removeBackgroundImage({
      inputPath: 'D:\\input\\frame.png',
      outputPath: 'D:\\output\\frame.png',
      model: 'u2netp',
      emitter: createEmitter(),
    });

    expect(writeFileMock).toHaveBeenCalledWith(
      'D:\\tmp\\sst-rembg-runner-test\\rembg_runner.py',
      expect.stringContaining('from rembg import new_session, remove'),
      'utf8'
    );
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          command: 'py',
          args: [
            '-3.11',
            'D:\\tmp\\sst-rembg-runner-test\\rembg_runner.py',
            '--input-path',
            'D:\\input\\frame.png',
            '--output-path',
            'D:\\output\\frame.png',
            '--model',
            'u2netp',
          ],
        },
      ])
    );
    expect(rmMock).toHaveBeenCalledWith('D:\\tmp\\sst-rembg-runner-test', {
      recursive: true,
      force: true,
    });
  });
});
