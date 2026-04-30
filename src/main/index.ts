import electron from 'electron';
import { createWindow } from './app/create-window';
import { registerIpcHandlers } from './ipc/register-handlers';

const { app, BrowserWindow } = electron;

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
