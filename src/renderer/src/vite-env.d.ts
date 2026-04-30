import type { MediaApi } from '../../shared/media-api';

declare global {
  interface Window {
    mediaApi: MediaApi;
  }
}

export {};
