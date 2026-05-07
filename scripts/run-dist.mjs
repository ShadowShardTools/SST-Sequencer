import { spawn } from 'node:child_process';
import { join } from 'node:path';

const requestedProfile = normalizeProfile(process.argv[2] ?? 'cpu');
const profiles = requestedProfile === 'all' ? ['cpu', 'cuda', 'directml'] : [requestedProfile];

for (const profile of profiles) {
  console.log(`[dist] Building ${profile} profile`);
  await runElectronBuilder(profile);
}

function normalizeProfile(value) {
  if (value === 'cpu' || value === 'cuda' || value === 'directml' || value === 'all') {
    return value;
  }

  throw new Error(`Unsupported dist profile: ${value}`);
}

function runElectronBuilder(profile) {
  const command = process.execPath;
  const args = [
    join(process.cwd(), 'node_modules', 'electron-builder', 'cli.js'),
    '--config',
    'electron-builder.config.cjs',
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        SST_BUNDLE_PROFILE: profile,
      },
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`electron-builder failed for profile "${profile}" with code ${code ?? 'unknown'}.`));
    });
  });
}
