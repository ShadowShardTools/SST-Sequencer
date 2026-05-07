/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const pkg = require('./package.json');

const profile = normalizeProfile(process.env.SST_BUNDLE_PROFILE);
const profileLabel = getProfileLabel(profile);

module.exports = {
  ...pkg.build,
  artifactName: `SST Sequencer Setup ${pkg.version} ${profileLabel}.${'${ext}'}`,
  directories: {
    ...(pkg.build?.directories ?? {}),
    output: path.join('release', profile),
  },
  extraResources: [
    { from: 'vendor/realesrgan', to: 'realesrgan' },
    { from: 'vendor/realcugan', to: 'realcugan' },
    { from: 'vendor/waifu2x', to: 'waifu2x' },
    { from: 'vendor/realsr', to: 'realsr' },
    { from: 'vendor/swinir', to: 'swinir' },
    { from: 'vendor/dat', to: 'dat' },
    { from: 'vendor/anime4kcpp', to: 'anime4kcpp' },
    ...getProfileResources(profile),
  ],
};

function normalizeProfile(value) {
  if (value === 'cuda' || value === 'directml' || value === 'cpu') {
    return value;
  }
  return 'cpu';
}

function getProfileLabel(value) {
  switch (value) {
    case 'cuda':
      return 'CUDA';
    case 'directml':
      return 'DirectML';
    case 'cpu':
    default:
      return 'CPU';
  }
}

function getProfileResources(value) {
  switch (value) {
    case 'cuda':
      return [
        { from: 'vendor/python311', to: 'python311' },
        { from: 'vendor/rembg/gpu', to: path.join('rembg', 'gpu') },
      ];
    case 'directml':
      return [
        { from: 'vendor/python311-directml', to: 'python311-directml' },
        { from: 'vendor/rembg/cpu', to: path.join('rembg', 'cpu') },
      ];
    case 'cpu':
    default:
      return [
        { from: 'vendor/python311-cpu', to: 'python311-cpu' },
        { from: 'vendor/rembg/cpu', to: path.join('rembg', 'cpu') },
      ];
  }
}
