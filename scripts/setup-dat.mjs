import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildPythonBackendReadme,
  createTempWorkspace,
  download,
  downloadFromGoogleDrive,
  exitIfSkipped,
  getProjectPaths,
  hasRequiredFiles,
  installDirectoryToVendor,
  removeDirectory,
} from './lib/setup-utils.mjs';

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'dat');
const sourceBaseUrl = 'https://raw.githubusercontent.com/zhengchen1999/DAT/main';
const requiredModelFiles = {
  'DAT_x2.pth': '1AYfLMnIqSlOJyOGabaRI48TEJh440fsN',
  'DAT_x3.pth': '1zRzZl8ogogzCSe6HDtcn4gk0ubH-5-aE',
  'DAT_x4.pth': '1pEhXmg--IWHaZOwHUFdh7TEJqt2qeuYg',
};
const requiredPaths = [
  'dat_arch.py',
  'LICENSE',
  ...Object.keys(requiredModelFiles).map((fileName) => join('models', fileName)),
];

exitIfSkipped('SST_SKIP_DAT_SETUP', 'dat');

if (await hasRequiredFiles(targetDir, requiredPaths)) {
  console.log('[setup:dat] DAT is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-dat-');
const installDir = join(tempRoot, 'install');
const modelsDir = join(installDir, 'models');

try {
  await mkdir(modelsDir, { recursive: true });

  console.log('[setup:dat] Downloading official DAT assets');
  await download(`${sourceBaseUrl}/basicsr/archs/dat_arch.py`, join(installDir, 'dat_arch.py'));
  await download(`${sourceBaseUrl}/LICENSE`, join(installDir, 'LICENSE'));
  await writeFile(
    join(installDir, 'README.txt'),
    buildPythonBackendReadme([
      'DAT assets installed by SST Sequencer.',
      'Upstream repository: https://github.com/zhengchen1999/DAT',
      'This folder contains the official DAT architecture file and the official DAT x2/x3/x4 pretrained weights.',
      'Runtime dependencies are not bundled here: Python, PyTorch, timm, einops, numpy, and opencv-python are required at execution time.',
    ]),
    'utf8'
  );

  for (const [fileName, fileId] of Object.entries(requiredModelFiles)) {
    await downloadFromGoogleDrive(fileId, join(modelsDir, fileName));
  }

  await installDirectoryToVendor({
    projectRoot,
    sourceDir: installDir,
    targetDir,
    requiredPathsToAssert: requiredPaths,
  });

  console.log('[setup:dat] Installed DAT into vendor/dat');
} finally {
  await removeDirectory(tempRoot);
}
