export interface SequenceSourcePreview {
  firstFramePath: string;
  frameCount: number;
  width?: number;
  height?: number;
  hasAlpha?: boolean;
}

export interface VideoSourcePreview {
  videoPath: string;
  width?: number;
  height?: number;
  frameRate?: number;
  durationSeconds?: number;
  hasAlpha?: boolean;
}
