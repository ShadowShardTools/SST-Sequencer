import type * as Electron from 'electron';
import type { JobRequest } from '../../shared/jobs';
import { runMediaJob } from '../media-service';

const { ipcMain } = require('electron') as typeof Electron;

export function registerJobHandlers(): void {
  ipcMain.handle('jobs:run', async (event, request: JobRequest) => {
    return runMediaJob(event.sender, request);
  });
}
