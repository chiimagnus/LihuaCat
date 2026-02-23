export type VideoSpec = {
  width: number;
  height: number;
  fps: number;
};

export type SubtitlePosition = "bottom" | "top" | "center";

export type SlideDirection = "left" | "right" | "up" | "down";

export type RenderTransition =
  | { type: "cut"; durationMs: number }
  | { type: "fade"; durationMs: number }
  | { type: "dissolve"; durationMs: number }
  | { type: "slide"; durationMs: number; direction: SlideDirection };

export type KenBurnsEffect = {
  startScale: number;
  endScale: number;
  panDirection: "left" | "right" | "up" | "down" | "center";
};

export type RenderScene = {
  sceneId: string;
  photoRef: string;
  subtitle: string;
  subtitlePosition: SubtitlePosition;
  durationSec: number;
  transition: RenderTransition;
  kenBurns?: KenBurnsEffect;
};

export type RenderAudioTrack = {
  path: string;
  format: "wav" | "mp3";
  startMs?: number;
  gain?: number;
};

export type RenderScript = {
  storyBriefRef: string;
  video: VideoSpec;
  scenes: RenderScene[];
  audioTrack?: RenderAudioTrack;
};

export type RenderScriptValidationResult = {
  valid: boolean;
  errors: string[];
};
