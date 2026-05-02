import { cp, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const targetDir = join(projectRoot, 'vendor', 'swinir');
const sourceBaseUrl = 'https://raw.githubusercontent.com/JingyunLiang/SwinIR/main';
const releaseBaseUrl = 'https://github.com/JingyunLiang/SwinIR/releases/download/v0.0';
const requiredModelFiles = [
  '001_classicalSR_DF2K_s64w8_SwinIR-M_x2.pth',
  '001_classicalSR_DF2K_s64w8_SwinIR-M_x3.pth',
  '001_classicalSR_DF2K_s64w8_SwinIR-M_x4.pth',
];

if (process.env.SST_SKIP_SWINIR_SETUP === '1') {
  console.log('[setup:swinir] Skipped by SST_SKIP_SWINIR_SETUP=1');
  process.exit(0);
}

if (await hasUsableInstall()) {
  console.log('[setup:swinir] SwinIR is already installed.');
  process.exit(0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'sst-swinir-'));
const installDir = join(tempRoot, 'install');
const modelsDir = join(installDir, 'models');

try {
  await mkdir(modelsDir, { recursive: true });

  console.log('[setup:swinir] Downloading official SwinIR assets');
  await download(
    `${sourceBaseUrl}/models/network_swinir.py`,
    join(installDir, 'network_swinir.py')
  );
  await download(`${sourceBaseUrl}/LICENSE`, join(installDir, 'LICENSE'));
  await writeFile(join(installDir, 'README.txt'), buildReadme(), 'utf8');

  for (const fileName of requiredModelFiles) {
    await download(`${releaseBaseUrl}/${fileName}`, join(modelsDir, fileName));
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(installDir, targetDir, { recursive: true });

  console.log('[setup:swinir] Installed SwinIR into vendor/swinir');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function hasUsableInstall() {
  try {
    await stat(join(targetDir, 'network_swinir.py'));
    await stat(join(targetDir, 'LICENSE'));
    await Promise.all(
      requiredModelFiles.map((fileName) => stat(join(targetDir, 'models', fileName)))
    );
    return true;
  } catch {
    return false;
  }
}

function buildReadme() {
  return [
    'SwinIR assets installed by SST Sequencer.',
    'Upstream repository: https://github.com/JingyunLiang/SwinIR',
    'This folder contains the official network definition and x2/x3/x4 classical SR weights.',
    'Runtime dependencies are not bundled here: Python, PyTorch, timm, numpy, and opencv-python are required at execution time.',
    '',
  ].join('\n');
}

function download(url, destination) {
  return new Promise((resolvePromise, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'sst-sequencer-setup',
        },
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          download(response.headers.location, destination).then(resolvePromise, reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode ?? 'unknown'}.`));
          return;
        }

        const file = createWriteStream(destination);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolvePromise();
        });
        file.on('error', reject);
      }
    );

    request.on('error', reject);
  });
}
