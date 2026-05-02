const { appendFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const logPath = join(tmpdir(), 'sst-sequencer-bootstrap.log');

function log(message, details) {
  const suffix = details === undefined ? '' : ` ${safeStringify(details)}`;
  appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${suffix}\n`);
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

process.on('uncaughtException', (error) => {
  log('bootstrap:uncaughtException', {
    message: error?.message,
    stack: error?.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  log('bootstrap:unhandledRejection', reason);
});

log('bootstrap:start', {
  cwd: process.cwd(),
  execPath: process.execPath,
  dirname: __dirname,
});

try {
  log('bootstrap:require-main:start', { target: './out/main/index.cjs' });
  require('./out/main/index.cjs');
  log('bootstrap:require-main:done');
} catch (error) {
  log('bootstrap:require-main:error', {
    message: error?.message,
    stack: error?.stack,
  });
  throw error;
}
