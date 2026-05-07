import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createTempWorkspace,
  download,
  exitIfSkipped,
  extractSevenZipArchive,
  findDirectoryContainingFile,
  getProjectPaths,
  hasRequiredFiles,
  installDirectoryToVendor,
  removeDirectory,
} from './lib/setup-utils.mjs';

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'anime4kcpp');
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

exitIfSkipped('SST_SKIP_ANIME4KCPP_SETUP', 'anime4kcpp');

const assetUrl = assetMap[process.platform];
if (!assetUrl) {
  console.log(
    `[setup:anime4kcpp] No official bundled Anime4KCPP CLI asset is configured for ${process.platform}. Skipping install.`
  );
  process.exit(0);
}

if (await hasRequiredFiles(targetDir, requiredRuntimeFiles)) {
  console.log('[setup:anime4kcpp] Anime4KCPP is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-anime4kcpp-');
const archivePath = join(tempRoot, 'anime4kcpp.7z');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:anime4kcpp] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractSevenZipArchive(archivePath, extractDir, projectRoot);

  const sourceDir = await findDirectoryContainingFile(extractDir, executableName, 4);
  if (!sourceDir) {
    throw new Error('Anime4KCPP archive did not contain ac_cli.exe.');
  }

  await installDirectoryToVendor({
    projectRoot,
    sourceDir,
    targetDir,
    executablePathToChmod: executableName,
    requiredPathsToAssert: requiredRuntimeFiles,
  });

  console.log('[setup:anime4kcpp] Installed Anime4KCPP into vendor/anime4kcpp');
} finally {
  await removeDirectory(tempRoot);
}
