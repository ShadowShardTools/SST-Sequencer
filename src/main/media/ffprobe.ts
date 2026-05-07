import { ensureBinaryAvailable, ffprobeBinary } from './binaries';
import { spawnManaged } from './job-runtime';

export async function probeVideoDuration(videoPath: string): Promise<number> {
  await ensureBinaryAvailable(ffprobeBinary, 'FFprobe');

  return new Promise((resolve, reject) => {
    const child = spawnManaged(
      ffprobeBinary,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        videoPath,
      ],
      {
        windowsHide: true,
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || 'FFprobe failed to read the video.'));
        return;
      }

      const duration = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('FFprobe did not return a valid duration.'));
        return;
      }

      resolve(duration);
    });
  });
}

export async function probeMediaInfo(targetPath: string): Promise<{
  width?: number;
  height?: number;
  frameRate?: number;
  durationSeconds?: number;
  pixelFormat?: string;
  hasAlpha?: boolean;
}> {
  await ensureBinaryAvailable(ffprobeBinary, 'FFprobe');

  return new Promise((resolve, reject) => {
    const child = spawnManaged(
      ffprobeBinary,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,avg_frame_rate,r_frame_rate,pix_fmt',
        '-show_entries',
        'format=duration',
        '-of',
        'json',
        targetPath,
      ],
      {
        windowsHide: true,
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || 'FFprobe failed to inspect the source.'));
        return;
      }

      try {
        const payload = JSON.parse(stdout) as {
          streams?: Array<{
            width?: number;
            height?: number;
            avg_frame_rate?: string;
            r_frame_rate?: string;
            pix_fmt?: string;
          }>;
          format?: {
            duration?: string;
          };
        };

        const stream = payload.streams?.[0];
        resolve({
          width: stream?.width,
          height: stream?.height,
          frameRate: parseFfprobeRate(stream?.avg_frame_rate ?? stream?.r_frame_rate),
          durationSeconds: payload.format?.duration
            ? Number.parseFloat(payload.format.duration)
            : undefined,
          pixelFormat: stream?.pix_fmt,
          hasAlpha: pixelFormatHasAlpha(stream?.pix_fmt),
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function pixelFormatHasAlpha(pixelFormat: string | undefined): boolean {
  if (!pixelFormat) {
    return false;
  }

  return /rgba|bgra|argb|abgr|ya8|yuva|gbrap|pal8|graya/i.test(pixelFormat);
}

function parseFfprobeRate(value: string | undefined): number | undefined {
  if (!value || value === '0/0') {
    return undefined;
  }

  if (!value.includes('/')) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  const [numerator, denominator] = value.split('/');
  const num = Number.parseFloat(numerator);
  const den = Number.parseFloat(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return undefined;
  }

  const result = num / den;
  return Number.isFinite(result) && result > 0 ? result : undefined;
}
