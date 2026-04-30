import electron from 'electron';
import type { VideoFormat } from '../shared/formats';
import type { JobEvent, JobRequest } from '../shared/jobs';
import type { MediaApi } from '../shared/media-api';

const { contextBridge, ipcRenderer, webUtils } = electron;

const api: MediaApi = {
  pickImageFiles: () => ipcRenderer.invoke('dialog:pick-image-files'),
  pickSequenceFolders: () => ipcRenderer.invoke('dialog:pick-sequence-folders'),
  pickVideoFiles: () => ipcRenderer.invoke('dialog:pick-video-files'),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  saveVideoFile: (defaultName: string, format: VideoFormat) =>
    ipcRenderer.invoke('dialog:save-video-file', defaultName, format),
  inspectSequenceSource: (input) => ipcRenderer.invoke('source:inspect-sequence', input),
  generateSequencePreview: (input) => ipcRenderer.invoke('preview:sequence-video', input),
  inspectVideoSource: (videoPath: string) => ipcRenderer.invoke('source:inspect-video', videoPath),
  loadImagePreview: (filePath: string) => ipcRenderer.invoke('preview:image-data-url', filePath),
  loadVideoPreview: (filePath: string) => ipcRenderer.invoke('preview:video-data-url', filePath),
  getPathForDroppedFile: (file: File) => webUtils.getPathForFile(file),
  revealPath: (targetPath: string) => ipcRenderer.invoke('paths:reveal', targetPath),
  runJob: (request: JobRequest) => ipcRenderer.invoke('jobs:run', request),
  onJobEvent: (listener: (event: JobEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: JobEvent) => {
      listener(payload);
    };

    ipcRenderer.on('jobs:event', handler);

    return () => {
      ipcRenderer.removeListener('jobs:event', handler);
    };
  },
};

contextBridge.exposeInMainWorld('mediaApi', api);
