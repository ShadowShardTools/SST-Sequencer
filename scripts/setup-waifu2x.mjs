import { chmod, cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const targetDir = join(projectRoot, 'vendor', 'waifu2x');
const version = '20250915';
const assetMap = {
  win32: `https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/${version}/waifu2x-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/${version}/waifu2x-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/${version}/waifu2x-ncnn-vulkan-${version}-macos.zip`,
};

const executableName =
  process.platform === 'win32' ? 'waifu2x-ncnn-vulkan.exe' : 'waifu2x-ncnn-vulkan';

if (process.env.SST_SKIP_WAIFU2X_SETUP === '1') {
  console.log('[setup:waifu2x] Skipped by SST_SKIP_WAIFU2X_SETUP=1');
  process.exit(0);
}

const assetUrl = assetMap[process.platform];
if (!assetUrl) {
  console.log(`[setup:waifu2x] Platform ${process.platform} is not supported by the setup script.`);
  process.exit(0);
}

if (await hasUsableInstall()) {
  console.log('[setup:waifu2x] Waifu2x is already installed.');
  process.exit(0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'sst-waifu2x-'));
const archivePath = join(tempRoot, 'waifu2x.zip');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:waifu2x] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractArchive(archivePath, extractDir);

  const sourceDir = await resolveExtractedSourceDir(extractDir);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });

  if (process.platform !== 'win32') {
    await chmod(join(targetDir, executableName), 0o755);
  }

  console.log('[setup:waifu2x] Installed Waifu2x into vendor/waifu2x');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function hasUsableInstall() {
  try {
    await stat(join(targetDir, executableName));
    await stat(join(targetDir, 'models-cunet'));
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
    throw new Error('Waifu2x archive did not contain an extracted directory.');
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
