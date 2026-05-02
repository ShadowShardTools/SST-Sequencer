import { existsSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { chmod, cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { path7za } from '7zip-bin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const targetDir = join(projectRoot, 'vendor', 'anime4kcpp');
const version = '3.0.0';
const assetMap = {
  win32: `https://github.com/TianZerL/Anime4KCPP/releases/download/v${version}/Anime4KCPP-CLI-v${version}-x64-MSVC.7z`,
};
const executableName = process.platform === 'win32' ? 'ac_cli.exe' : 'ac_cli';
const requiredRuntimeFiles =
  process.platform === 'win32'
    ? [
        executableName,
        'avcodec-60.dll',
        'avformat-60.dll',
        'avutil-58.dll',
        'swresample-4.dll',
        'swscale-7.dll',
      ]
    : [executableName];

if (process.env.SST_SKIP_ANIME4KCPP_SETUP === '1') {
  console.log('[setup:anime4kcpp] Skipped by SST_SKIP_ANIME4KCPP_SETUP=1');
  process.exit(0);
}

const assetUrl = assetMap[process.platform];
if (!assetUrl) {
  console.log(
    `[setup:anime4kcpp] No official bundled Anime4KCPP CLI asset is configured for ${process.platform}. Skipping install.`
  );
  process.exit(0);
}

if (await hasUsableInstall()) {
  console.log('[setup:anime4kcpp] Anime4KCPP is already installed.');
  process.exit(0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'sst-anime4kcpp-'));
const archivePath = join(tempRoot, 'anime4kcpp.7z');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:anime4kcpp] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractArchive(archivePath, extractDir);

  const sourceDir = await resolveExtractedSourceDir(extractDir);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });

  if (process.platform !== 'win32') {
    await chmod(join(targetDir, executableName), 0o755);
  }

  console.log('[setup:anime4kcpp] Installed Anime4KCPP into vendor/anime4kcpp');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function hasUsableInstall() {
  try {
    await Promise.all(requiredRuntimeFiles.map((fileName) => stat(join(targetDir, fileName))));
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
  if (!existsSync(path7za)) {
    throw new Error('7za executable from 7zip-bin could not be resolved.');
  }

  await runCommand(path7za, ['x', archivePath, `-o${extractPath}`, '-y']);
}

async function resolveExtractedSourceDir(extractPath) {
  const directMatch = await findDirectoryContainingExecutable(extractPath, 4);
  if (!directMatch) {
    throw new Error('Anime4KCPP archive did not contain ac_cli.exe.');
  }

  return directMatch;
}

async function findDirectoryContainingExecutable(searchRoot, depthRemaining) {
  const executableAtRoot = existsSync(join(searchRoot, executableName));
  if (executableAtRoot) {
    return searchRoot;
  }

  if (depthRemaining <= 0) {
    return null;
  }

  const entries = await readdir(searchRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const found = await findDirectoryContainingExecutable(
      join(searchRoot, entry.name),
      depthRemaining - 1
    );
    if (found) {
      return found;
    }
  }

  return null;
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
