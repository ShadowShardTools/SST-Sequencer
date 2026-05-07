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

const { projectRoot, targetDir } = getProjectPaths(import.meta.url, 'python311-cpu');
const pythonVersion = '3.11.9';
const pythonEmbedUrl = `https://www.python.org/ftp/python/${pythonVersion}/python-${pythonVersion}-embed-amd64.zip`;
const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
const torchCpuIndexUrl = 'https://download.pytorch.org/whl/cpu';
const requiredPaths = [
  'python.exe',
  'python311.dll',
  'python311._pth',
  join('Lib', 'site-packages', 'torch'),
  join('Lib', 'site-packages', 'cv2'),
  join('Lib', 'site-packages', 'numpy'),
  join('Lib', 'site-packages', 'timm'),
  join('Lib', 'site-packages', 'einops'),
];

exitIfSkipped('SST_SKIP_PYTHON311_CPU_SETUP', 'python311-cpu');

if (process.platform !== 'win32') {
  console.log('[setup:python311-cpu] Bundled Python 3.11 CPU runtime is only configured for Windows.');
  process.exit(0);
}

if (await hasRequiredFiles(targetDir, requiredPaths)) {
  console.log('[setup:python311-cpu] Bundled Python 3.11 CPU runtime is already installed.');
  process.exit(0);
}

const tempRoot = await createTempWorkspace('sst-python311-cpu-');
const archivePath = join(tempRoot, 'python-embed.zip');
const extractDir = join(tempRoot, 'python311-cpu');
const getPipPath = join(extractDir, 'get-pip.py');
const pythonExe = join(extractDir, 'python.exe');

try {
  console.log(`[setup:python311-cpu] Downloading Python ${pythonVersion} embeddable package`);
  await download(pythonEmbedUrl, archivePath);
  await mkdir(extractDir, { recursive: true });
  await extractZipArchive(archivePath, extractDir, projectRoot);

  await prepareEmbeddedPythonLayout(extractDir);

  console.log('[setup:python311-cpu] Bootstrapping pip');
  await download(getPipUrl, getPipPath);
  await runCommand(pythonExe, ['get-pip.py'], extractDir);
  await runCommand(
    pythonExe,
    ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'],
    extractDir
  );

  console.log('[setup:python311-cpu] Installing CPU-only PyTorch');
  await runCommand(
    pythonExe,
    ['-m', 'pip', 'install', 'torch', '--index-url', torchCpuIndexUrl],
    extractDir
  );

  console.log('[setup:python311-cpu] Installing shared Python dependencies');
  await runCommand(
    pythonExe,
    ['-m', 'pip', 'install', 'opencv-python', 'numpy', 'timm', 'einops'],
    extractDir
  );

  await writeFile(
    join(extractDir, 'README.txt'),
    buildPythonBackendReadme([
      'Bundled Python 3.11 CPU runtime installed by SST Sequencer.',
      `Base runtime: Python ${pythonVersion} Windows embeddable package from python.org.`,
      'Bundled packages:',
      '  - torch (CPU-only, from the official PyTorch CPU index)',
      '  - opencv-python',
      '  - numpy',
      '  - timm',
      '  - einops',
      '',
      'This runtime is used by DAT and SwinIR for CPU-only builds or CPU fallback.',
    ]),
    'utf8'
  );

  await installDirectoryToVendor({
    projectRoot,
    sourceDir: extractDir,
    targetDir,
    requiredPathsToAssert: requiredPaths,
  });

  console.log('[setup:python311-cpu] Installed bundled Python 3.11 CPU runtime into vendor/python311-cpu');
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
