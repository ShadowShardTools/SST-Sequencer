import { sortNaturalPaths } from './path-utils';

export type DroppedPayload = {
  paths: string[];
  containsDirectory: boolean;
};

type DroppedEntry = {
  isFile: boolean;
  isDirectory: boolean;
  file?: (callback: (file: File) => void) => void;
  createReader?: () => {
    readEntries: (callback: (entries: DroppedEntry[]) => void) => void;
  };
};

export async function extractDroppedPayload(dataTransfer: DataTransfer): Promise<DroppedPayload> {
  const itemEntries = [...dataTransfer.items]
    .map((item) => getDroppedEntry(item))
    .filter((entry): entry is DroppedEntry => Boolean(entry));

  if (itemEntries.length > 0) {
    const containsDirectory = itemEntries.some((entry) => entry.isDirectory);
    const paths = (
      await Promise.all(itemEntries.map((entry) => collectDroppedEntryPaths(entry)))
    ).flat();

    return {
      containsDirectory,
      paths: sortNaturalPaths(paths),
    };
  }

  const filePaths = (
    await Promise.all(
      [...dataTransfer.files].map((file) => window.mediaApi.getPathForDroppedFile(file))
    )
  ).filter((filePath): filePath is string => Boolean(filePath));

  return {
    containsDirectory: false,
    paths: sortNaturalPaths(filePaths),
  };
}

function getDroppedEntry(item: DataTransferItem): DroppedEntry | null {
  if ('webkitGetAsEntry' in item && typeof item.webkitGetAsEntry === 'function') {
    return item.webkitGetAsEntry() as DroppedEntry | null;
  }
  return null;
}

async function collectDroppedEntryPaths(entry: DroppedEntry): Promise<string[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File | null>((resolve) => {
      entry.file?.((value) => resolve(value ?? null));
    });

    if (!file) {
      return [];
    }

    const filePath = window.mediaApi.getPathForDroppedFile(file);
    return filePath ? [filePath] : [];
  }

  if (entry.isDirectory && entry.createReader) {
    const entries = await new Promise<DroppedEntry[]>((resolve) => {
      const reader = entry.createReader?.();
      if (!reader) {
        resolve([]);
        return;
      }

      const collected: DroppedEntry[] = [];
      const readBatch = (): void => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(collected);
            return;
          }

          collected.push(...batch);
          readBatch();
        });
      };

      readBatch();
    });

    return (await Promise.all(entries.map((child) => collectDroppedEntryPaths(child)))).flat();
  }

  return [];
}
