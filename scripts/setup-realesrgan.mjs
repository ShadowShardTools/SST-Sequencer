import { chmod, cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const targetDir = join(projectRoot, 'vendor', 'realesrgan');
const version = 'v0.2.0';
const modelSourceCommit = '22cc70605fabb517419b4e7959d46bbb869684d8';
const assetMap = {
  win32: `https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/${version}/realesrgan-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/${version}/realesrgan-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/${version}/realesrgan-ncnn-vulkan-${version}-macos.zip`,
};
const requiredModelFiles = [
  'realesr-animevideov3-x2.bin',
  'realesr-animevideov3-x2.param',
  'realesr-animevideov3-x3.bin',
  'realesr-animevideov3-x3.param',
  'realesr-animevideov3-x4.bin',
  'realesr-animevideov3-x4.param',
];

const executableName =
  process.platform === 'win32' ? 'realesrgan-ncnn-vulkan.exe' : 'realesrgan-ncnn-vulkan';

if (process.env.SST_SKIP_REALESRGAN_SETUP === '1') {
  console.log('[setup:realesrgan] Skipped by SST_SKIP_REALESRGAN_SETUP=1');
  process.exit(0);
}

const assetUrl = assetMap[process.platform];
if (!assetUrl) {
  console.log(
    `[setup:realesrgan] Platform ${process.platform} is not supported by the setup script.`
  );
  process.exit(0);
}

if (await hasUsableInstall()) {
  console.log('[setup:realesrgan] Real-ESRGAN is already installed.');
  process.exit(0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'sst-realesrgan-'));
const archivePath = join(tempRoot, 'realesrgan.zip');
const extractDir = join(tempRoot, 'extract');
const installDir = join(tempRoot, 'install');

try {
  await mkdir(extractDir, { recursive: true });
  await mkdir(installDir, { recursive: true });
  console.log(`[setup:realesrgan] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractArchive(archivePath, extractDir);

  const sourceDir = await resolveExtractedSourceDir(extractDir);
  await cp(sourceDir, installDir, { recursive: true });
  await downloadRequiredModels(join(installDir, 'models'));

  if (process.platform !== 'win32') {
    await chmod(join(installDir, executableName), 0o755);
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(installDir, targetDir, { recursive: true });

  console.log('[setup:realesrgan] Installed Real-ESRGAN into vendor/realesrgan');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function hasUsableInstall() {
  try {
    await stat(join(targetDir, executableName));
    await Promise.all(
      requiredModelFiles.map((fileName) => stat(join(targetDir, 'models', fileName)))
    );
    return true;
  } catch {
    return false;
  }
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

async function extractArchive(archivePath, extractPath) {
  if (process.platform === 'win32') {
    await runCommand('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractPath.replace(/'/g, "''")}' -Force`,
    ]);
    return;
  }

  await runCommand('unzip', ['-o', archivePath, '-d', extractPath]);
}

async function resolveExtractedSourceDir(extractPath) {
  const entries = await readdir(extractPath, { withFileTypes: true });
  const executableAtRoot = entries.some((entry) => entry.isFile() && entry.name === executableName);

  if (executableAtRoot) {
    return extractPath;
  }

  const firstDirectory = entries.find((entry) => entry.isDirectory());
  if (!firstDirectory) {
    throw new Error('Real-ESRGAN archive did not contain an extracted directory.');
  }

  return join(extractPath, firstDirectory.name);
}

async function downloadRequiredModels(modelsDir) {
  await mkdir(modelsDir, { recursive: true });

  for (const fileName of requiredModelFiles) {
    const url =
      `https://raw.githubusercontent.com/Moebytes/waifu2x/${modelSourceCommit}` +
      `/real-esrgan/models/${fileName}`;
    const destination = join(modelsDir, fileName);
    console.log(`[setup:realesrgan] Downloading model ${fileName}`);
    await download(url, destination);
  }
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
    });
  });
}
