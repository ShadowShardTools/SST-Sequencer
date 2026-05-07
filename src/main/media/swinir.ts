import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AlphaMode } from '../../shared/formats';
import {
  ensureBinaryAvailable,
  resolveSwinIrModelsDir,
  resolveSwinIrNetworkPath,
  resolveSwinIrVendorDir,
} from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import { spawnManaged } from './job-runtime';
import type { JobEmitter } from './types';

const SWINIR_SCALES = [2, 3, 4] as const;
const SWINIR_MODEL_FILES: Record<(typeof SWINIR_SCALES)[number], string> = {
  2: '001_classicalSR_DF2K_s64w8_SwinIR-M_x2.pth',
  3: '001_classicalSR_DF2K_s64w8_SwinIR-M_x3.pth',
  4: '001_classicalSR_DF2K_s64w8_SwinIR-M_x4.pth',
};
const SWINIR_TILE_SIZE = 400;
const SWINIR_TILE_OVERLAP = 32;

type PythonCommand = {
  command: string;
  argsPrefix: string[];
  label: string;
};

let cachedPythonCommandPromise: Promise<PythonCommand> | null = null;
let cachedDependencyCheckPromise: Promise<void> | null = null;

export async function ensureSwinIrAvailable(): Promise<void> {
  const vendorDir = resolveSwinIrVendorDir();
  const modelsDir = resolveSwinIrModelsDir();
  const networkPath = resolveSwinIrNetworkPath();

  if (!vendorDir) {
    throw new Error('SwinIR vendor directory could not be resolved.');
  }
  if (!modelsDir) {
    throw new Error('SwinIR models directory could not be resolved.');
  }
  if (!networkPath) {
    throw new Error('SwinIR network definition could not be resolved.');
  }

  await ensureBinaryAvailable(networkPath, 'SwinIR network definition');
  await Promise.all(
    SWINIR_SCALES.map((scale) => access(join(modelsDir, SWINIR_MODEL_FILES[scale])))
  );

  const python = await resolvePythonCommand();
  await ensureSwinIrDependencies(python);
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  preserveAlpha?: boolean;
  alphaMode?: AlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  if (!SWINIR_SCALES.includes(options.scale as (typeof SWINIR_SCALES)[number])) {
    throw new Error(`Unsupported SwinIR scale: ${options.scale}.`);
  }

  await ensureSwinIrAvailable();
  await mkdir(options.outputDir, { recursive: true });

  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: (inputDir, outputDir) =>
        runSwinIrDirectory(inputDir, outputDir, options.scale, options.emitter),
    });
    return;
  }

  await runSwinIrDirectory(options.inputDir, options.outputDir, options.scale, options.emitter);
}

async function runSwinIrDirectory(
  inputDir: string,
  outputDir: string,
  scale: number,
  emitter: JobEmitter
): Promise<void> {
  const python = await resolvePythonCommand();
  const vendorDir = resolveSwinIrVendorDir();
  const modelsDir = resolveSwinIrModelsDir();
  const runnerTempDir = await mkdtemp(join(tmpdir(), 'sst-swinir-runner-'));
  const runnerPath = join(runnerTempDir, 'swinir_runner.py');

  try {
    await writeFile(runnerPath, SWINIR_RUNNER_SCRIPT, 'utf8');
    await runSwinIr(
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
        '--model-path',
        join(modelsDir, SWINIR_MODEL_FILES[scale as keyof typeof SWINIR_MODEL_FILES]),
        '--tile',
        String(SWINIR_TILE_SIZE),
        '--tile-overlap',
        String(SWINIR_TILE_OVERLAP),
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
    'SwinIR requires Python 3.11, but no usable Python 3.11 command was found. Install Python 3.11 and ensure it is available as "python3.11" or "py -3.11".'
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

async function ensureSwinIrDependencies(python: PythonCommand): Promise<void> {
  if (!cachedDependencyCheckPromise) {
    cachedDependencyCheckPromise = runProcess(python.command, [
      ...python.argsPrefix,
      '-c',
      [
        'import importlib.util, sys',
        "required = ['torch', 'cv2', 'numpy', 'timm']",
        'missing = [name for name in required if importlib.util.find_spec(name) is None]',
        'sys.exit(1 if missing else 0)',
      ].join('; '),
    ]).catch(() => {
      throw new Error(
        `SwinIR requires Python 3.11 with torch, timm, numpy, and opencv-python installed.\n` +
        `  ${python.label} -m pip install torch timm numpy opencv-python\n` +
        `For AMD GPU on Windows DirectML:\n` +
        `  ${python.label} -m pip install torch-directml\n` +
        `For AMD GPU on Linux ROCm:\n` +
        `  ${python.label} -m pip install torch --index-url https://download.pytorch.org/whl/rocm6.2`
      );
    });
  }

  await cachedDependencyCheckPromise;
}

async function runSwinIr(
  python: PythonCommand,
  args: string[],
  emitter: JobEmitter
): Promise<void> {
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
        new Error(
          outputTail.slice(-12).join(' | ') || `SwinIR exited with code ${code ?? 'unknown'}.`
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

const SWINIR_RUNNER_SCRIPT = String.raw`import argparse
import glob
import os
import sys

import cv2
import numpy as np
import torch


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--scale', required=True, type=int)
    parser.add_argument('--vendor-dir', required=True)
    parser.add_argument('--model-path', required=True)
    parser.add_argument('--tile', type=int, default=400)
    parser.add_argument('--tile-overlap', type=int, default=32)
    return parser.parse_args()


def define_model(scale, model_path):
    sys.path.insert(0, os.path.abspath(args.vendor_dir))
    from network_swinir import SwinIR as net

    model = net(
        upscale=scale,
        in_chans=3,
        img_size=64,
        window_size=8,
        img_range=1.0,
        depths=[6, 6, 6, 6, 6, 6],
        embed_dim=180,
        num_heads=[6, 6, 6, 6, 6, 6],
        mlp_ratio=2,
        upsampler='pixelshuffle',
        resi_connection='1conv',
    )
    pretrained_model = torch.load(model_path, map_location='cpu')
    if isinstance(pretrained_model, dict):
        if 'params' in pretrained_model:
            pretrained_model = pretrained_model['params']
        elif 'params_ema' in pretrained_model:
            pretrained_model = pretrained_model['params_ema']
    model.load_state_dict(pretrained_model, strict=True)
    return model


def get_device():
    # CUDA covers both NVIDIA and AMD on Linux with ROCm PyTorch builds,
    # since ROCm exposes the same torch.cuda API.
    if torch.cuda.is_available():
        device = torch.device('cuda')
        print(f'[SwinIR] Using GPU: {torch.cuda.get_device_name(0)}', flush=True)
        return device

    # DirectML covers AMD and Intel GPUs on Windows without ROCm.
    try:
        import torch_directml
        device = torch_directml.device()
        print(f'[SwinIR] Using DirectML device: {torch_directml.device_name(0)}', flush=True)
        return device
    except ImportError:
        pass

    # Apple Silicon via MPS.
    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        print('[SwinIR] Using Apple MPS device.', flush=True)
        return torch.device('mps')

    print('[SwinIR] No GPU found, falling back to CPU.', flush=True)
    return torch.device('cpu')


def test(img_lq, model, scale, window_size, tile, tile_overlap):
    if not tile or min(img_lq.shape[-2:]) < window_size:
        return model(img_lq)

    b, c, h, w = img_lq.size()
    tile = min(tile, h, w)
    tile = (tile // window_size) * window_size
    if tile < window_size:
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
            in_patch = img_lq[..., h_idx : h_idx + tile, w_idx : w_idx + tile]
            out_patch = model(in_patch)
            out_patch_mask = torch.ones_like(out_patch)
            output_acc[
                ...,
                h_idx * scale : (h_idx + tile) * scale,
                w_idx * scale : (w_idx + tile) * scale,
            ].add_(out_patch)
            weight_acc[
                ...,
                h_idx * scale : (h_idx + tile) * scale,
                w_idx * scale : (w_idx + tile) * scale,
            ].add_(out_patch_mask)

    return output_acc.div_(weight_acc)


def main():
    global args
    args = parse_args()
    print(f'[SwinIR] Python: {sys.version}', flush=True)
    print(f'[SwinIR] Torch: {torch.__version__}', flush=True)
    print(f'[SwinIR] CUDA available: {torch.cuda.is_available()}', flush=True)
    os.makedirs(args.output_dir, exist_ok=True)

    device = get_device()
    model = define_model(args.scale, args.model_path)
    model.eval()
    model = model.to(device)

    input_paths = sorted(glob.glob(os.path.join(args.input_dir, '*')))
    if not input_paths:
        raise RuntimeError('No input images were found for SwinIR.')

    with torch.no_grad():
        for path in input_paths:
            imgname = os.path.splitext(os.path.basename(path))[0]
            img_lq = cv2.imread(path, cv2.IMREAD_COLOR)
            if img_lq is None:
                raise RuntimeError(f'Failed to decode image: {path}')

            img_lq = img_lq.astype(np.float32) / 255.0
            img_lq = np.transpose(img_lq[:, :, [2, 1, 0]], (2, 0, 1))
            img_lq = torch.from_numpy(img_lq).float().unsqueeze(0).to(device)

            _, _, h_old, w_old = img_lq.size()
            window_size = 8
            h_pad = (h_old // window_size + 1) * window_size - h_old
            w_pad = (w_old // window_size + 1) * window_size - w_old
            img_lq = torch.cat([img_lq, torch.flip(img_lq, [2])], 2)[:, :, : h_old + h_pad, :]
            img_lq = torch.cat([img_lq, torch.flip(img_lq, [3])], 3)[:, :, :, : w_old + w_pad]

            output = test(
                img_lq,
                model,
                args.scale,
                window_size,
                args.tile,
                args.tile_overlap,
            )
            output = output[..., : h_old * args.scale, : w_old * args.scale]
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
