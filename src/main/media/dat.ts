import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AlphaMode } from '../../shared/formats';
import {
  ensureBinaryAvailable,
  resolveDatArchPath,
  resolveDatModelsDir,
  resolveDatVendorDir,
} from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
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

type PythonCommand = {
  command: string;
  argsPrefix: string[];
  label: string;
};

let cachedPythonCommandPromise: Promise<PythonCommand> | null = null;
let cachedDependencyCheckPromise: Promise<void> | null = null;

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
  const candidates: PythonCommand[] =
    process.platform === 'win32'
      ? [
        { command: 'py', argsPrefix: ['-3.11'], label: 'py -3.11' },
        { command: 'python3.11', argsPrefix: [], label: 'python3.11' },
      ]
      : [{ command: 'python3.11', argsPrefix: [], label: 'python3.11' }];

  for (const candidate of candidates) {
    const ok = await canRunPython(candidate);
    if (ok) {
      return candidate;
    }
  }

  throw new Error(
    'DAT requires Python 3.11, but no usable Python 3.11 command was found. Install Python 3.11 and ensure it is available as "python3.11" or "py -3.11".'
  );
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
        `DAT requires Python 3.11 with torch, timm, einops, numpy, and opencv-python installed.\n` +
        `  ${python.label} -m pip install torch timm einops numpy opencv-python\n` +
        `For AMD GPU on Windows DirectML:\n` +
        `  ${python.label} -m pip install torch-directml\n` +
        `For AMD GPU on Linux ROCm:\n` +
        `  ${python.label} -m pip install torch --index-url https://download.pytorch.org/whl/rocm6.2`
      );
    });
  }

  await cachedDependencyCheckPromise;
}

async function runDat(python: PythonCommand, args: string[], emitter: JobEmitter): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnManaged(python.command, [...python.argsPrefix, ...args], {
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
    print(f'[DAT] Python: {sys.version}', flush=True)
    print(f'[DAT] Torch: {torch.__version__}', flush=True)
    print(f'[DAT] CUDA available: {torch.cuda.is_available()}', flush=True)
    print(f'[DAT] CUDA version: {torch.version.cuda}', flush=True)

    if torch.cuda.is_available():
        device = torch.device('cuda')
        print(f'[DAT] Using GPU: {torch.cuda.get_device_name(0)}', flush=True)
        return device

    try:
        import torch_directml
        device = torch_directml.device()
        print(f'[DAT] Using DirectML device: {torch_directml.device_name(0)}', flush=True)
        return device
    except ImportError:
        pass

    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        print('[DAT] Using Apple MPS device.', flush=True)
        return torch.device('mps')

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


def test(img_lq, model, scale, tile, tile_overlap):
    if not tile:
        return model(img_lq)

    b, c, h, w = img_lq.size()
    tile = min(tile, h, w)
    if tile < 8:
        return model(img_lq)

    stride = tile - tile_overlap
    if stride <= 0:
        stride = tile

    h_idx_list = list(range(0, h - tile, stride)) + [h - tile]
    w_idx_list = list(range(0, w - tile, stride)) + [w - tile]
    output_acc = torch.zeros(b, c, h * scale, w * scale).type_as(img_lq)
    weight_acc = torch.zeros_like(output_acc)

    for h_idx in h_idx_list:
      for w_idx in w_idx_list:
        in_patch = img_lq[..., h_idx:h_idx + tile, w_idx:w_idx + tile]
        out_patch = model(in_patch)
        out_patch_mask = torch.ones_like(out_patch)
        output_acc[
            ...,
            h_idx * scale:(h_idx + tile) * scale,
            w_idx * scale:(w_idx + tile) * scale,
        ].add_(out_patch)
        weight_acc[
            ...,
            h_idx * scale:(h_idx + tile) * scale,
            w_idx * scale:(w_idx + tile) * scale,
        ].add_(out_patch_mask)

    return output_acc.div_(weight_acc)


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

            output = test(img_lq, model, args.scale, args.tile, args.tile_overlap)
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
