import { registerClipboardHandlers } from './clipboard-handlers';
import { registerDialogHandlers } from './dialog-handlers';
import { registerJobHandlers } from './job-handlers';
import { registerPathHandlers } from './path-handlers';
import { registerPreviewHandlers } from './preview-handlers';

let handlersRegistered = false;

export function registerIpcHandlers(): void {
  if (handlersRegistered) {
    return;
  }

  handlersRegistered = true;

  registerDialogHandlers();
  registerPreviewHandlers();
  registerPathHandlers();
  registerClipboardHandlers();
  registerJobHandlers();
}
