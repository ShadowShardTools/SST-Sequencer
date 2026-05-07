import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  assertFilesExist,
  copyDirectoryContents,
  copyFiles,
  createTempWorkspace,
  download,
  exitIfSkipped,
  extractZipArchive,
  getProjectPaths,
  hasRequiredFiles,
  installDirectoryToVendor,
  removeDirectory,
  resolveExtractedSourceDir,
  resolveNestedDirectory,
  resolvePlatformAsset,
} from './lib/setup-utils.mjs';

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'realesrgan');
const version = 'v0.3.0';
const assetMap = {
  win32: `https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/${version}/realesrgan-ncnn-vulkan-${version}-windows.zip`,
  linux: `https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/${version}/realesrgan-ncnn-vulkan-${version}-ubuntu.zip`,
  darwin: `https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/${version}/realesrgan-ncnn-vulkan-${version}-macos.zip`,
};
const modelArchiveUrl =
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip';
const requiredModelFiles = [
  'realesrgan-x4plus.bin',
  'realesrgan-x4plus.param',
  'realesrgan-x4plus-anime.bin',
  'realesrgan-x4plus-anime.param',
  'realesr-animevideov3-x2.bin',
  'realesr-animevideov3-x2.param',
  'realesr-animevideov3-x3.bin',
  'realesr-animevideov3-x3.param',
  'realesr-animevideov3-x4.bin',
  'realesr-animevideov3-x4.param',
];
const requiredPaths = [
  process.platform === 'win32' ? 'realesrgan-ncnn-vulkan.exe' : 'realesrgan-ncnn-vulkan',
  ...requiredModelFiles.map((fileName) => join('models', fileName)),
];

const executableName =
  process.platform === 'win32' ? 'realesrgan-ncnn-vulkan.exe' : 'realesrgan-ncnn-vulkan';

exitIfSkipped('SST_SKIP_REALESRGAN_SETUP', 'realesrgan');

const assetUrl = resolvePlatformAsset(assetMap, 'realesrgan');
if (await hasRequiredFiles(targetDir, requiredPaths)) {
  console.log('[setup:realesrgan] Real-ESRGAN is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-realesrgan-');
const archivePath = join(tempRoot, 'realesrgan.zip');
const modelArchivePath = join(tempRoot, 'realesrgan-models.zip');
const extractDir = join(tempRoot, 'extract');
const modelExtractDir = join(tempRoot, 'model-extract');
const installDir = join(tempRoot, 'install');

try {
  await mkdir(extractDir, { recursive: true });
  await mkdir(modelExtractDir, { recursive: true });
  await mkdir(installDir, { recursive: true });

  console.log(`[setup:realesrgan] Downloading ${assetUrl}`);
  await download(assetUrl, archivePath);
  await extractZipArchive(archivePath, extractDir, projectRoot);

  const sourceDir = await resolveExtractedSourceDir(extractDir, executableName);
  await mkdir(join(installDir, 'models'), { recursive: true });
  await copyDirectoryContents(sourceDir, installDir);

  console.log(`[setup:realesrgan] Downloading ${modelArchiveUrl}`);
  await download(modelArchiveUrl, modelArchivePath);
  await extractZipArchive(modelArchivePath, modelExtractDir, projectRoot);

  const sourceModelsDir = await resolveNestedDirectory(modelExtractDir, 'models');
  await copyFiles(requiredModelFiles, sourceModelsDir, join(installDir, 'models'));
  await assertFilesExist(installDir, requiredPaths);

  await installDirectoryToVendor({
    projectRoot,
    sourceDir: installDir,
    targetDir,
    executablePathToChmod: executableName,
    requiredPathsToAssert: requiredPaths,
  });

  console.log('[setup:realesrgan] Installed Real-ESRGAN into vendor/realesrgan');
} finally {
  await removeDirectory(tempRoot);
}
