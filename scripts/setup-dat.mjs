import { cp, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const targetDir = join(projectRoot, 'vendor', 'dat');
const sourceBaseUrl = 'https://raw.githubusercontent.com/zhengchen1999/DAT/main';
const requiredModelFiles = {
  'DAT_x2.pth': '1AYfLMnIqSlOJyOGabaRI48TEJh440fsN',
  'DAT_x3.pth': '1zRzZl8ogogzCSe6HDtcn4gk0ubH-5-aE',
  'DAT_x4.pth': '1pEhXmg--IWHaZOwHUFdh7TEJqt2qeuYg',
};

if (process.env.SST_SKIP_DAT_SETUP === '1') {
  console.log('[setup:dat] Skipped by SST_SKIP_DAT_SETUP=1');
  process.exit(0);
}

if (await hasUsableInstall()) {
  console.log('[setup:dat] DAT is already installed.');
  process.exit(0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'sst-dat-'));
const installDir = join(tempRoot, 'install');
const modelsDir = join(installDir, 'models');

try {
  await mkdir(modelsDir, { recursive: true });

  console.log('[setup:dat] Downloading official DAT assets');
  await download(`${sourceBaseUrl}/basicsr/archs/dat_arch.py`, join(installDir, 'dat_arch.py'));
  await download(`${sourceBaseUrl}/LICENSE`, join(installDir, 'LICENSE'));
  await writeFile(join(installDir, 'README.txt'), buildReadme(), 'utf8');

  for (const [fileName, fileId] of Object.entries(requiredModelFiles)) {
    await downloadFromGoogleDrive(fileId, join(modelsDir, fileName));
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(installDir, targetDir, { recursive: true });

  console.log('[setup:dat] Installed DAT into vendor/dat');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function hasUsableInstall() {
  try {
    await stat(join(targetDir, 'dat_arch.py'));
    await stat(join(targetDir, 'LICENSE'));
    await Promise.all(
      Object.keys(requiredModelFiles).map((fileName) => stat(join(targetDir, 'models', fileName)))
    );
    return true;
  } catch {
    return false;
  }
}

function buildReadme() {
  return [
    'DAT assets installed by SST Sequencer.',
    'Upstream repository: https://github.com/zhengchen1999/DAT',
    'This folder contains the official DAT architecture file and the official DAT x2/x3/x4 pretrained weights.',
    'Runtime dependencies are not bundled here: Python, PyTorch, timm, einops, numpy, and opencv-python are required at execution time.',
    '',
  ].join('\n');
}

function downloadFromGoogleDrive(fileId, destination) {
  const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  return download(url, destination);
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
