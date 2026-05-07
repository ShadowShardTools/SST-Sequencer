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

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'realsr');
const version = '20220728';
const assetMap = {
  win32: `https://github.com/nihui/realsr-ncnn-vulkan/releases/download/${version}/realsr-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/nihui/realsr-ncnn-vulkan/releases/download/${version}/realsr-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/nihui/realsr-ncnn-vulkan/releases/download/${version}/realsr-ncnn-vulkan-${version}-macos.zip`,
};
const requiredModelFiles = [
  join('models-DF2K_JPEG', 'x4.bin'),
  join('models-DF2K_JPEG', 'x4.param'),
];

const executableName =
  process.platform === 'win32' ? 'realsr-ncnn-vulkan.exe' : 'realsr-ncnn-vulkan';

exitIfSkipped('SST_SKIP_REALSR_SETUP', 'realsr');

const assetUrl = resolvePlatformAsset(assetMap, 'realsr');
if (await hasRequiredFiles(targetDir, [executableName, ...requiredModelFiles])) {
  console.log('[setup:realsr] RealSR is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-realsr-');
const archivePath = join(tempRoot, 'realsr.zip');
const extractDir = join(tempRoot, 'extract');

try {
  await mkdir(extractDir, { recursive: true });
  console.log(`[setup:realsr] Downloading ${assetUrl}`);
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

  console.log('[setup:realsr] Installed RealSR into vendor/realsr');
} finally {
  await removeDirectory(tempRoot);
}
