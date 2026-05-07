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

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'realcugan');
const version = '20220728';
const assetMap = {
  win32: `https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/${version}/realcugan-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/${version}/realcugan-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/${version}/realcugan-ncnn-vulkan-${version}-macos.zip`,
};
const requiredModelFiles = [
  join('models-se', 'up2x-no-denoise.bin'),
  join('models-se', 'up2x-no-denoise.param'),
  join('models-se', 'up3x-no-denoise.bin'),
  join('models-se', 'up3x-no-denoise.param'),
  join('models-se', 'up4x-no-denoise.bin'),
  join('models-se', 'up4x-no-denoise.param'),
];

const executableName =
  process.platform === 'win32' ? 'realcugan-ncnn-vulkan.exe' : 'realcugan-ncnn-vulkan';

exitIfSkipped('SST_SKIP_REALCUGAN_SETUP', 'realcugan');

const assetUrl = resolvePlatformAsset(assetMap, 'realcugan');
if (await hasRequiredFiles(targetDir, [executableName, ...requiredModelFiles])) {
  console.log('[setup:realcugan] Real-CUGAN is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-realcugan-');
const archivePath = join(tempRoot, 'realcugan.zip');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:realcugan] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractZipArchive(archivePath, extractDir, projectRoot);

  const sourceDir = await resolveExtractedSourceDir(extractDir, executableName);
  await installDirectoryToVendor({
    projectRoot,
    sourceDir,
    targetDir,
    executablePathToChmod: executableName,
    requiredPathsToAssert: [executableName, ...requiredModelFiles],
  });

  console.log('[setup:realcugan] Installed Real-CUGAN into vendor/realcugan');
} finally {
  await removeDirectory(tempRoot);
}
