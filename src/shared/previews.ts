export interface SequenceSourcePreview {
  firstFramePath: string;
  frameCount: number;
  width?: number;
  height?: number;
}

export interface VideoSourcePreview {
  videoPath: string;
  width?: number;
  height?: number;
  frameRate?: number;
  durationSeconds?: number;
}
