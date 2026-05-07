import type { Dispatch, SetStateAction } from 'react';
import type { VideoFormat } from '../../../shared/formats';
import type { DropNotice } from '../components/fields';
import { extractDroppedPayload } from '../lib/drop';
import { isImagePath, isVideoPath } from '../lib/file-types';
import {
  buildSuggestedVideoName,
  getParentDirectory,
  replacePathExtension,
  sortNaturalPaths,
} from '../lib/path-utils';

type SetJob<T> = Dispatch<SetStateAction<T>>;
type SetDropNotice = Dispatch<SetStateAction<DropNotice | null>>;

export function createSequenceSourceActions<T extends {
  sourceMode: 'folder' | 'images';
  sequenceFolder?: string;
  imagePaths?: string[];
}>(setJob: SetJob<T>, setDropNotice: SetDropNotice) {
  return {
    async pickSequenceFolder(): Promise<void> {
      const folder = await window.mediaApi.pickFolder();
      if (!folder) {
        return;
      }

      setDropNotice(null);
      setJob((current) => ({
        ...current,
        sourceMode: 'folder',
        sequenceFolder: folder,
        imagePaths: [],
      }));
    },

    async pickSequenceImages(): Promise<void> {
      const imagePaths = await window.mediaApi.pickImageFiles();
      if (imagePaths.length === 0) {
        return;
      }

      setDropNotice(null);
      setJob((current) => ({
        ...current,
        sourceMode: 'images',
        imagePaths,
        sequenceFolder: '',
      }));
    },

    async handleSourceDrop(dataTransfer: DataTransfer): Promise<void> {
      const dropped = await extractDroppedPayload(dataTransfer);
      const imagePaths = dropped.paths.filter(isImagePath);

      if (imagePaths.length === 0) {
        setDropNotice({
          tone: 'error',
          text: 'Drop one sequence folder or one or more supported image files.',
        });
        return;
      }

      const sortedPaths = sortNaturalPaths(imagePaths);
      const uniqueParents = [...new Set(sortedPaths.map(getParentDirectory))];

      if (dropped.containsDirectory && uniqueParents.length === 1) {
        setDropNotice(null);
        setJob((current) => ({
          ...current,
          sourceMode: 'folder',
          sequenceFolder: uniqueParents[0],
          imagePaths: [],
        }));
        return;
      }

      setDropNotice(null);
      setJob((current) => ({
        ...current,
        sourceMode: 'images',
        imagePaths: sortedPaths,
        sequenceFolder: '',
      }));
    },
  };
}

export function createImageSourceActions<T extends { imagePaths?: string[] }>(
  setJob: SetJob<T>,
  setDropNotice: SetDropNotice
) {
  return {
    async pickImages(): Promise<void> {
      const imagePaths = await window.mediaApi.pickImageFiles();
      if (imagePaths.length === 0) {
        return;
      }

      setDropNotice(null);
      setJob((current) => ({
        ...current,
        imagePaths,
      }));
    },

    async handleSourceDrop(dataTransfer: DataTransfer): Promise<void> {
      const dropped = await extractDroppedPayload(dataTransfer);
      const imagePaths = sortNaturalPaths(dropped.paths.filter(isImagePath));

      if (dropped.containsDirectory || imagePaths.length === 0) {
        setDropNotice({
          tone: 'error',
          text: 'Drop one or more supported image files here, not a folder.',
        });
        return;
      }

      setDropNotice(null);
      setJob((current) => ({
        ...current,
        imagePaths,
      }));
    },
  };
}

export function createSingleVideoSourceActions<T extends { videoPath?: string }>(
  setJob: SetJob<T>,
  setDropNotice: SetDropNotice
) {
  return {
    async pickVideo(): Promise<void> {
      const videoPaths = await window.mediaApi.pickVideoFiles();
      if (videoPaths.length === 0) {
        return;
      }

      setDropNotice(null);
      setJob((current) => ({
        ...current,
        videoPath: videoPaths[0],
      }));
    },

    async handleSourceDrop(dataTransfer: DataTransfer): Promise<void> {
      const dropped = await extractDroppedPayload(dataTransfer);
      const videoPaths = sortNaturalPaths(dropped.paths.filter(isVideoPath));

      if (dropped.containsDirectory) {
        setDropNotice({
          tone: 'error',
          text: 'Drop one video file here, not a folder.',
        });
        return;
      }

      if (videoPaths.length !== 1) {
        setDropNotice({
          tone: 'error',
          text: 'Drop exactly one supported video file.',
        });
        return;
      }

      setDropNotice(null);
      setJob((current) => ({
        ...current,
        videoPath: videoPaths[0],
      }));
    },
  };
}

export function createBatchVideoSourceActions<T extends {
  sourceMode: 'files' | 'scan-root';
  videoPaths?: string[];
  scanRoot?: string;
}>(setJob: SetJob<T>) {
  return {
    async pickVideoFiles(): Promise<void> {
      const videoPaths = await window.mediaApi.pickVideoFiles();
      if (videoPaths.length === 0) {
        return;
      }

      setJob((current) => ({
        ...current,
        sourceMode: 'files',
        videoPaths,
        scanRoot: '',
      }));
    },

    async pickScanRoot(): Promise<void> {
      const folder = await window.mediaApi.pickFolder();
      if (!folder) {
        return;
      }

      setJob((current) => ({
        ...current,
        sourceMode: 'scan-root',
        scanRoot: folder,
      }));
    },
  };
}

export function createBatchImageSourceActions<T extends {
  sourceMode: 'files' | 'scan-root';
  imagePaths?: string[];
  scanRoot?: string;
}>(setJob: SetJob<T>) {
  return {
    async pickImageFiles(): Promise<void> {
      const imagePaths = await window.mediaApi.pickImageFiles();
      if (imagePaths.length === 0) {
        return;
      }

      setJob((current) => ({
        ...current,
        sourceMode: 'files',
        imagePaths,
        scanRoot: '',
      }));
    },

    async pickScanRoot(): Promise<void> {
      const folder = await window.mediaApi.pickFolder();
      if (!folder) {
        return;
      }

      setJob((current) => ({
        ...current,
        sourceMode: 'scan-root',
        scanRoot: folder,
      }));
    },
  };
}

export function createBatchSequenceSourceActions<T extends {
  sourceMode: 'folders' | 'scan-root';
  sequenceFolders?: string[];
  scanRoot?: string;
}>(setJob: SetJob<T>) {
  return {
    async pickSequenceFolders(): Promise<void> {
      const sequenceFolders = await window.mediaApi.pickSequenceFolders();
      if (sequenceFolders.length === 0) {
        return;
      }

      setJob((current) => ({
        ...current,
        sourceMode: 'folders',
        sequenceFolders,
        scanRoot: '',
      }));
    },

    async pickScanRoot(): Promise<void> {
      const folder = await window.mediaApi.pickFolder();
      if (!folder) {
        return;
      }

      setJob((current) => ({
        ...current,
        sourceMode: 'scan-root',
        scanRoot: folder,
      }));
    },
  };
}

export function createFolderOutputAction<T extends object, TKey extends keyof T>(setJob: SetJob<T>, key: TKey) {
  return async function pickFolderOutput(): Promise<void> {
    const folder = await window.mediaApi.pickFolder();
    if (!folder) {
      return;
    }

    setJob((current) => ({
      ...current,
      [key]: folder,
    }) as T);
  };
}

export function createVideoOutputAction<T extends { outputPath?: string; format: VideoFormat }>(
  job: T,
  setJob: SetJob<T>,
  sourcePath: string | undefined
) {
  return async function pickOutputVideo(): Promise<void> {
    const defaultName = job.outputPath?.trim()
      ? replacePathExtension(job.outputPath, job.format)
      : buildSuggestedVideoName(sourcePath, job.format);
    const filePath = await window.mediaApi.saveVideoFile(defaultName, job.format);
    if (!filePath) {
      return;
    }

    setJob((current) => ({
      ...current,
      outputPath: filePath,
    }));
  };
}
