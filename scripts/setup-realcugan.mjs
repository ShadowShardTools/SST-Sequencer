import { chmod, cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const targetDir = join(projectRoot, 'vendor', 'realcugan');
const version = '20220728';
const assetMap = {
  win32: `https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/${version}/realcugan-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/${version}/realcugan-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/${version}/realcugan-ncnn-vulkan-${version}-macos.zip`,
};
const requiredModelFiles = [
  'up2x-no-denoise.bin',
  'up2x-no-denoise.param',
  'up3x-no-denoise.bin',
  'up3x-no-denoise.param',
  'up4x-no-denoise.bin',
  'up4x-no-denoise.param',
];

const executableName =
  process.platform === 'win32' ? 'realcugan-ncnn-vulkan.exe' : 'realcugan-ncnn-vulkan';

if (process.env.SST_SKIP_REALCUGAN_SETUP === '1') {
  console.log('[setup:realcugan] Skipped by SST_SKIP_REALCUGAN_SETUP=1');
  process.exit(0);
}

const assetUrl = assetMap[process.platform];
if (!assetUrl) {
  console.log(
    `[setup:realcugan] Platform ${process.platform} is not supported by the setup script.`
  );
  process.exit(0);
}

if (await hasUsableInstall()) {
  console.log('[setup:realcugan] Real-CUGAN is already installed.');
  process.exit(0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'sst-realcugan-'));
const archivePath = join(tempRoot, 'realcugan.zip');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:realcugan] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractArchive(archivePath, extractDir);

  const sourceDir = await resolveExtractedSourceDir(extractDir);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });

  if (process.platform !== 'win32') {
    await chmod(join(targetDir, executableName), 0o755);
  }

  console.log('[setup:realcugan] Installed Real-CUGAN into vendor/realcugan');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function hasUsableInstall() {
  try {
    await stat(join(targetDir, executableName));
    await Promise.all(
      requiredModelFiles.map((fileName) => stat(join(targetDir, 'models-se', fileName)))
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
    throw new Error('Real-CUGAN archive did not contain an extracted directory.');
  }

  return join(extractPath, firstDirectory.name);
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
