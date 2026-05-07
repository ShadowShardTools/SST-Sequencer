import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildPythonBackendReadme,
  createTempWorkspace,
  download,
  exitIfSkipped,
  extractZipArchive,
  getProjectPaths,
  hasRequiredFiles,
  installDirectoryToVendor,
  removeDirectory,
  runCommand,
} from './lib/setup-utils.mjs';

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'python311-directml');
const pythonVersion = '3.11.9';
const pythonEmbedUrl = `https://www.python.org/ftp/python/${pythonVersion}/python-${pythonVersion}-embed-amd64.zip`;
const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
const requiredPaths = [
  'python.exe',
  'python311.dll',
  'python311._pth',
  join('Lib', 'site-packages', 'torch'),
  join('Lib', 'site-packages', 'torch_directml'),
  join('Lib', 'site-packages', 'cv2'),
  join('Lib', 'site-packages', 'numpy'),
  join('Lib', 'site-packages', 'timm'),
  join('Lib', 'site-packages', 'einops'),
];

exitIfSkipped('SST_SKIP_PYTHON311_DIRECTML_SETUP', 'python311-directml');

if (process.platform !== 'win32') {
  console.log(
    '[setup:python311-directml] Bundled Python 3.11 DirectML runtime is only configured for Windows.'
  );
  process.exit(0);
}

if (await hasRequiredFiles(targetDir, requiredPaths)) {
  console.log('[setup:python311-directml] Bundled Python 3.11 DirectML runtime is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-python311-directml-');
const archivePath = join(tempRoot, 'python-embed.zip');
const extractDir = join(tempRoot, 'python311-directml');
const getPipPath = join(extractDir, 'get-pip.py');
const pythonExe = join(extractDir, 'python.exe');

try {
  console.log(
    `[setup:python311-directml] Downloading Python ${pythonVersion} embeddable package`
  );
  await download(pythonEmbedUrl, archivePath);
  await mkdir(extractDir, { recursive: true });
  await extractZipArchive(archivePath, extractDir, projectRoot);

  await prepareEmbeddedPythonLayout(extractDir);

  console.log('[setup:python311-directml] Bootstrapping pip');
  await download(getPipUrl, getPipPath);
  await runCommand(pythonExe, ['get-pip.py'], extractDir);
  await runCommand(
    pythonExe,
    ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'],
    extractDir
  );

  console.log('[setup:python311-directml] Installing DirectML PyTorch runtime');
  await runCommand(
    pythonExe,
    ['-m', 'pip', 'install', 'torch-directml'],
    extractDir
  );

  console.log('[setup:python311-directml] Installing shared Python dependencies');
  await runCommand(
    pythonExe,
    ['-m', 'pip', 'install', 'opencv-python', 'numpy', 'timm', 'einops'],
    extractDir
  );

  await writeFile(
    join(extractDir, 'README.txt'),
    buildPythonBackendReadme([
      'Bundled Python 3.11 DirectML runtime installed by SST Sequencer.',
      `Base runtime: Python ${pythonVersion} Windows embeddable package from python.org.`,
      'Bundled packages:',
      '  - torch-directml (which installs the matching torch/torchvision stack)',
      '  - opencv-python',
      '  - numpy',
      '  - timm',
      '  - einops',
      '',
      'This runtime is used by DAT and SwinIR on Windows when no NVIDIA CUDA path is preferred.',
      'DirectML can accelerate supported AMD, Intel, and NVIDIA DirectX 12 GPUs.',
      'This runtime is separate from the bundled CUDA runtime to avoid torch package conflicts.',
    ]),
    'utf8'
  );

  await installDirectoryToVendor({
    projectRoot,
    sourceDir: extractDir,
    targetDir,
    requiredPathsToAssert: requiredPaths,
  });

  console.log(
    '[setup:python311-directml] Installed bundled Python 3.11 DirectML runtime into vendor/python311-directml'
  );
} finally {
  await removeDirectory(tempRoot);
}

async function prepareEmbeddedPythonLayout(extractDir) {
  const pthPath = join(extractDir, 'python311._pth');
  const existing = await readFile(pthPath, 'utf8');
  const lines = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '#import site');

  const merged = new Set(lines);
  merged.add('python311.zip');
  merged.add('.');
  merged.add('Lib');
  merged.add('Lib/site-packages');
  merged.add('import site');

  await mkdir(join(extractDir, 'Lib', 'site-packages'), { recursive: true });
  await writeFile(pthPath, `${[...merged].join('\n')}\n`, 'utf8');
}
