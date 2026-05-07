import { spawn } from 'node:child_process';
import https from 'node:https';
import { join } from 'node:path';
import {
  copyDirectoryContents,
  createTempWorkspace,
  download,
  exitIfSkipped,
  extractSevenZipArchive,
  getProjectPaths,
  hasRequiredFiles,
  installDirectoryToVendor,
  removeDirectory,
  runCommand,
} from './lib/setup-utils.mjs';

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'rembg');
const version = 'v2.0.75';
const pymattingVersion = '1.1.15';
const assetMap = {
  cpu: {
    win32: `https://github.com/danielgatis/rembg/releases/download/${version}/rembg-cli-cpu-installer.exe`,
  },
  gpu: {
    win32: `https://github.com/danielgatis/rembg/releases/download/${version}/rembg-cli-gpu-installer.exe`,
  },
};

exitIfSkipped('SST_SKIP_REMBG_SETUP', 'rembg');

if (process.platform !== 'win32') {
  console.log('[setup:rembg] Bundled rembg CLI installers are currently only configured for Windows.');
  process.exit(0);
}

const variantsToInstall = await resolveVariantsToInstall();
if (await hasRequiredVariantInstalls(variantsToInstall)) {
  console.log(
    `[setup:rembg] Rembg CLI is already installed for: ${variantsToInstall.join(', ')}.`
  );
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-rembg-');
const pymattingWheelPath = join(tempRoot, 'pymatting.whl');
const pymattingExtractDir = join(tempRoot, 'pymatting-extract');

try {
  console.log('[setup:rembg] Repairing bundled rembg runtimes with missing pymatting package');
  const pymattingWheelUrl = await resolveWheelUrl('pymatting', pymattingVersion);
  await download(pymattingWheelUrl, pymattingWheelPath);
  await extractSevenZipArchive(pymattingWheelPath, pymattingExtractDir, projectRoot);

  await removeDirectory(targetDir);

  for (const variant of variantsToInstall) {
    const assetUrl = assetMap[variant][process.platform];
    if (!assetUrl) {
      throw new Error(`No rembg ${variant} installer is configured for ${process.platform}.`);
    }

    const installerPath = join(tempRoot, `rembg-${variant}-installer.exe`);
    const installDir = join(tempRoot, `install-${variant}`);

    console.log(`[setup:rembg] Downloading ${variant.toUpperCase()} installer: ${assetUrl}`);
    await download(assetUrl, installerPath);

    console.log(
      `[setup:rembg] Running official rembg ${variant.toUpperCase()} installer in silent mode`
    );
    await runCommand(
      installerPath,
      ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/DIR=${installDir}`],
      projectRoot
    );

    await copyDirectoryContents(pymattingExtractDir, join(installDir, '_internal'));

    await installDirectoryToVendor({
      projectRoot,
      sourceDir: installDir,
      targetDir: join(targetDir, variant),
      requiredPathsToAssert: getRequiredVariantPaths(),
    });
  }

  console.log(
    `[setup:rembg] Installed rembg CLI variants into vendor/rembg: ${variantsToInstall.join(', ')}`
  );
} finally {
  await removeDirectory(tempRoot);
}

async function resolveVariantsToInstall() {
  const raw = process.env.SST_REMBG_VARIANT?.trim().toLowerCase();
  if (raw === 'cpu' || raw === 'gpu') {
    return [raw];
  }

  if (raw === 'auto') {
    return (await hasNvidiaGpuAtSetup()) ? ['gpu'] : ['cpu'];
  }

  return ['cpu', 'gpu'];
}

function getRequiredVariantPaths() {
  return [
    'rembg.exe',
    '_internal',
    '_internal/pymatting',
    `_internal/pymatting-${pymattingVersion}.dist-info`,
  ];
}

async function hasRequiredVariantInstalls(variants) {
  const legacyFlatInstall = await hasRequiredFiles(targetDir, getRequiredVariantPaths());
  if (legacyFlatInstall) {
    return false;
  }

  const results = await Promise.all(
    variants.map((variant) => hasRequiredFiles(join(targetDir, variant), getRequiredVariantPaths()))
  );
  return results.every(Boolean);
}

async function hasNvidiaGpuAtSetup() {
  const candidates = [
    { command: 'nvidia-smi', args: ['-L'] },
    {
      command: join(
        process.env.ProgramW6432 || process.env.ProgramFiles || 'C:\\Program Files',
        'NVIDIA Corporation',
        'NVSMI',
        'nvidia-smi.exe'
      ),
      args: ['-L'],
    },
  ];

  for (const candidate of candidates) {
    if (await canRunQuietly(candidate.command, candidate.args)) {
      return true;
    }
  }

  return false;
}

async function canRunQuietly(command, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: 'ignore',
    });

    child.on('error', () => resolvePromise(false));
    child.on('close', (code) => resolvePromise(code === 0));
  });
}

async function resolveWheelUrl(packageName, packageVersion) {
  const metadata = await fetchJson(`https://pypi.org/pypi/${packageName}/${packageVersion}/json`);
  const wheel = metadata.urls?.find(
    (entry) => entry.packagetype === 'bdist_wheel' && entry.filename?.endsWith('.whl')
  );

  if (!wheel?.url) {
    throw new Error(`Could not find a wheel for ${packageName} ${packageVersion}.`);
  }

  return wheel.url;
}

async function fetchJson(url) {
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
          fetchJson(response.headers.location).then(resolvePromise, reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(`Request to ${url} failed with status ${response.statusCode ?? 'unknown'}.`)
          );
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('error', reject);
  });
}
