import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildPythonBackendReadme,
  createTempWorkspace,
  download,
  exitIfSkipped,
  getProjectPaths,
  hasRequiredFiles,
  installDirectoryToVendor,
  removeDirectory,
} from './lib/setup-utils.mjs';

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'swinir');
const sourceBaseUrl = 'https://raw.githubusercontent.com/JingyunLiang/SwinIR/main';
const releaseBaseUrl = 'https://github.com/JingyunLiang/SwinIR/releases/download/v0.0';
const requiredModelFiles = [
  '001_classicalSR_DF2K_s64w8_SwinIR-M_x2.pth',
  '001_classicalSR_DF2K_s64w8_SwinIR-M_x3.pth',
  '001_classicalSR_DF2K_s64w8_SwinIR-M_x4.pth',
];
const requiredPaths = [
  'network_swinir.py',
  'LICENSE',
  ...requiredModelFiles.map((fileName) => join('models', fileName)),
];

exitIfSkipped('SST_SKIP_SWINIR_SETUP', 'swinir');

if (await hasRequiredFiles(targetDir, requiredPaths)) {
  console.log('[setup:swinir] SwinIR is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-swinir-');
const installDir = join(tempRoot, 'install');
const modelsDir = join(installDir, 'models');

try {
  await mkdir(modelsDir, { recursive: true });

  console.log('[setup:swinir] Downloading official SwinIR assets');
  await download(
    `${sourceBaseUrl}/models/network_swinir.py`,
    join(installDir, 'network_swinir.py')
  );
  await download(`${sourceBaseUrl}/LICENSE`, join(installDir, 'LICENSE'));
  await writeFile(
    join(installDir, 'README.txt'),
    buildPythonBackendReadme([
      'SwinIR assets installed by SST Sequencer.',
      'Upstream repository: https://github.com/JingyunLiang/SwinIR',
      'This folder contains the official network definition and x2/x3/x4 classical SR weights.',
      'Runtime dependencies are not bundled here: Python, PyTorch, timm, numpy, and opencv-python are required at execution time.',
    ]),
    'utf8'
  );

  for (const fileName of requiredModelFiles) {
    await download(`${releaseBaseUrl}/${fileName}`, join(modelsDir, fileName));
  }

  await installDirectoryToVendor({
    projectRoot,
    sourceDir: installDir,
    targetDir,
    requiredPathsToAssert: requiredPaths,
  });

  console.log('[setup:swinir] Installed SwinIR into vendor/swinir');
} finally {
  await removeDirectory(tempRoot);
}
