import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createTempWorkspace,
  download,
  exitIfSkipped,
  extractZipArchive,
  getProjectPaths,
  hasRequiredFiles,
  installDirectoryToVendor,
  removeDirectory,
  resolveExtractedSourceDir,
  resolvePlatformAsset,
} from './lib/setup-utils.mjs';

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'waifu2x');
const version = '20250915';
const assetMap = {
  win32: `https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/${version}/waifu2x-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/${version}/waifu2x-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/${version}/waifu2x-ncnn-vulkan-${version}-macos.zip`,
};

const executableName =
  process.platform === 'win32' ? 'waifu2x-ncnn-vulkan.exe' : 'waifu2x-ncnn-vulkan';

exitIfSkipped('SST_SKIP_WAIFU2X_SETUP', 'waifu2x');

const assetUrl = resolvePlatformAsset(assetMap, 'waifu2x');
if (await hasRequiredFiles(targetDir, [executableName, 'models-cunet'])) {
  console.log('[setup:waifu2x] Waifu2x is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-waifu2x-');
const archivePath = join(tempRoot, 'waifu2x.zip');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:waifu2x] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractZipArchive(archivePath, extractDir, projectRoot);

  const sourceDir = await resolveExtractedSourceDir(extractDir, executableName);
  await installDirectoryToVendor({
    projectRoot,
    sourceDir,
    targetDir,
    executablePathToChmod: executableName,
    requiredPathsToAssert: [executableName, 'models-cunet'],
  });

  console.log('[setup:waifu2x] Installed Waifu2x into vendor/waifu2x');
} finally {
  await removeDirectory(tempRoot);
}
