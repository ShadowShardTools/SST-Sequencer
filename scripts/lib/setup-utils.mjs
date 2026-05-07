import { existsSync, createWriteStream } from 'node:fs';
import { chmod, cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { path7za } from '7zip-bin';

export function getProjectPaths(importMetaUrl, vendorName) {
  const __dirname = dirname(fileURLToPath(importMetaUrl));
  const projectRoot = resolve(__dirname, '..');
  const targetDir = join(projectRoot, 'vendor', vendorName);

  return {
    __dirname,
    projectRoot,
    targetDir,
  };
}

export function exitIfSkipped(envVarName, label) {
  if (process.env[envVarName] === '1') {
    console.log(`[setup:${label}] Skipped by ${envVarName}=1`);
    process.exit(0);
  }
}

export function resolvePlatformAsset(assetMap, label) {
  const assetUrl = assetMap[process.platform];
  if (!assetUrl) {
    console.log(
      `[setup:${label}] Platform ${process.platform} is not supported by the setup script.`
    );
    process.exit(0);
  }

  return assetUrl;
}

export async function hasRequiredFiles(baseDir, relativePaths) {
  try {
    await Promise.all(relativePaths.map((relativePath) => stat(join(baseDir, relativePath))));
    return true;
  } catch {
    return false;
  }
}

export async function createTempWorkspace(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function download(url, destination) {
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

export function downloadFromGoogleDrive(fileId, destination) {
  const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  return download(url, destination);
}

export async function extractZipArchive(archivePath, extractPath, projectRoot) {
  if (process.platform === 'win32') {
    await runCommand(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractPath.replace(/'/g, "''")}' -Force`,
      ],
      projectRoot
    );
    return;
  }

  await runCommand('unzip', ['-o', archivePath, '-d', extractPath], projectRoot);
}

export async function extractSevenZipArchive(archivePath, extractPath, projectRoot) {
  if (!existsSync(path7za)) {
    throw new Error('7za executable from 7zip-bin could not be resolved.');
  }

  await runCommand(path7za, ['x', archivePath, `-o${extractPath}`, '-y'], projectRoot);
}

export async function resolveExtractedSourceDir(extractPath, executableName) {
  const entries = await readdir(extractPath, { withFileTypes: true });
  const executableAtRoot = entries.some((entry) => entry.isFile() && entry.name === executableName);

  if (executableAtRoot) {
    return extractPath;
  }

  const firstDirectory = entries.find((entry) => entry.isDirectory());
  if (!firstDirectory) {
    throw new Error(`Archive did not contain ${executableName} or an extracted directory.`);
  }

  return join(extractPath, firstDirectory.name);
}

export async function findDirectoryContainingFile(searchRoot, fileName, depthRemaining = 4) {
  if (existsSync(join(searchRoot, fileName))) {
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

    const found = await findDirectoryContainingFile(
      join(searchRoot, entry.name),
      fileName,
      depthRemaining - 1
    );
    if (found) {
      return found;
    }
  }

  return null;
}

export async function resolveNestedDirectory(extractPath, relativeDir) {
  const directPath = join(extractPath, relativeDir);

  try {
    await stat(directPath);
    return directPath;
  } catch {
    // continue
  }

  const entries = await readdir(extractPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = join(extractPath, entry.name, relativeDir);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error(`Could not find ${relativeDir} in the extracted archive.`);
}

export async function assertFilesExist(baseDir, relativePaths) {
  await Promise.all(relativePaths.map((relativePath) => stat(join(baseDir, relativePath))));
}

export async function copyFiles(relativePaths, sourceDir, destinationDir) {
  await mkdir(destinationDir, { recursive: true });

  for (const relativePath of relativePaths) {
    await cp(join(sourceDir, relativePath), join(destinationDir, relativePath), { force: true });
  }
}

export async function copyDirectoryContents(sourceDir, destinationDir) {
  await mkdir(destinationDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    await cp(join(sourceDir, entry.name), join(destinationDir, entry.name), {
      recursive: entry.isDirectory(),
      force: true,
    });
  }
}

export async function installDirectoryToVendor(options) {
  const { projectRoot, sourceDir, targetDir, executablePathToChmod, requiredPathsToAssert } =
    options;

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(join(projectRoot, 'vendor'), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });

  if (process.platform !== 'win32' && executablePathToChmod) {
    await chmod(join(targetDir, executablePathToChmod), 0o755);
  }

  if (requiredPathsToAssert?.length) {
    await assertFilesExist(targetDir, requiredPathsToAssert);
  }
}

export async function removeDirectory(path) {
  await rm(path, { recursive: true, force: true });
}

export function buildPythonBackendReadme(lines) {
  return [...lines, ''].join('\n');
}

export async function runCommand(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
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
