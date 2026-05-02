import { chmod, cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const targetDir = join(projectRoot, 'vendor', 'realsr');
const version = '20220728';
const assetMap = {
  win32: `https://github.com/nihui/realsr-ncnn-vulkan/releases/download/${version}/realsr-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/nihui/realsr-ncnn-vulkan/releases/download/${version}/realsr-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/nihui/realsr-ncnn-vulkan/releases/download/${version}/realsr-ncnn-vulkan-${version}-macos.zip`,
};
const requiredModelFiles = ['x4.bin', 'x4.param'];

const executableName =
  process.platform === 'win32' ? 'realsr-ncnn-vulkan.exe' : 'realsr-ncnn-vulkan';

if (process.env.SST_SKIP_REALSR_SETUP === '1') {
  console.log('[setup:realsr] Skipped by SST_SKIP_REALSR_SETUP=1');
  process.exit(0);
}

const assetUrl = assetMap[process.platform];
if (!assetUrl) {
  console.log(`[setup:realsr] Platform ${process.platform} is not supported by the setup script.`);
  process.exit(0);
}

if (await hasUsableInstall()) {
  console.log('[setup:realsr] RealSR is already installed.');
  process.exit(0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'sst-realsr-'));
const archivePath = join(tempRoot, 'realsr.zip');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:realsr] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractArchive(archivePath, extractDir);

  const sourceDir = await resolveExtractedSourceDir(extractDir);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });

  if (process.platform !== 'win32') {
    await chmod(join(targetDir, executableName), 0o755);
  }

  console.log('[setup:realsr] Installed RealSR into vendor/realsr');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function hasUsableInstall() {
  try {
    await stat(join(targetDir, executableName));
    await Promise.all(
      requiredModelFiles.map((fileName) => stat(join(targetDir, 'models-DF2K_JPEG', fileName)))
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
    throw new Error('RealSR archive did not contain an extracted directory.');
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
