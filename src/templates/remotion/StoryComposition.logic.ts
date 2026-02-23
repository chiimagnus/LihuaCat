import type { StoryTemplateProps } from "./StoryComposition.schema.ts";

export const secondsToFrames = (seconds: number, fps: number): number => {
  return Math.max(1, Math.round(seconds * fps));
};

export const msToFrames = (ms: number, fps: number): number => {
  return Math.max(0, Math.round(ms / 1000 * fps));
};

export type SceneWindow = {
  sceneId: string;
  startFrame: number;
  endFrame: number;
  assetPath: string;
  subtitle: string;
  subtitlePosition: "bottom" | "top" | "center";
  transition: {
    type: "cut" | "fade" | "dissolve" | "slide";
    durationMs: number;
    direction?: "left" | "right" | "up" | "down";
  };
  kenBurns?: {
    startScale: number;
    endScale: number;
    panDirection: "left" | "right" | "up" | "down" | "center";
  };
};

export type SceneLayer = {
  sceneId: string;
  assetPath: string;
  subtitle: string;
  subtitlePosition: "bottom" | "top" | "center";
  opacity: number;
  translateX: number;
  translateY: number;
  progressInScene: number; // 0..1
  kenBurns?: SceneWindow["kenBurns"];
};

export const buildSceneWindows = (
  props: StoryTemplateProps,
  fps: number,
): SceneWindow[] => {
  const assetPathByPhotoRef = new Map(
    props.assets.map((asset) => [asset.photoRef, asset.path]),
  );
  let cursorFrame = 0;
  return props.scenes.map((scene) => {
    const startFrame = cursorFrame;
    const durationInFrames = secondsToFrames(scene.durationSec, fps);
    const endFrame = startFrame + durationInFrames;
    cursorFrame = endFrame;
    return {
      sceneId: scene.sceneId,
      startFrame,
      endFrame,
      assetPath: assetPathByPhotoRef.get(scene.photoRef) ?? "",
      subtitle: scene.subtitle,
      subtitlePosition: scene.subtitlePosition,
      transition: scene.transition,
      kenBurns: scene.kenBurns,
    };
  });
};

export const computeStoryDurationInFrames = (
  props: StoryTemplateProps,
  fps: number,
): number => {
  const windows = buildSceneWindows(props, fps);
  const visualEnd = windows.length > 0 ? windows[windows.length - 1]!.endFrame : 0;
  const audioTrack = props.audioTrack;
  const audioEnd =
    audioTrack && typeof audioTrack.durationSec === "number"
      ? msToFrames(audioTrack.startMs ?? 0, fps) + secondsToFrames(audioTrack.durationSec, fps)
      : 0;
  return Math.max(1, visualEnd, audioEnd);
};

export const computeSceneLayers = (
  windows: SceneWindow[],
  frame: number,
  fps: number,
): SceneLayer[] => {
  if (windows.length === 0) {
    return [];
  }

  const clampedFrame = Math.max(0, frame);
  const currentIndex = findCurrentWindowIndex(windows, clampedFrame);
  const current = windows[currentIndex]!;
  const next = windows[currentIndex + 1];

  const durationFrames = Math.max(1, current.endFrame - current.startFrame);
  const progressInScene = clamp01((clampedFrame - current.startFrame) / durationFrames);

  if (!next) {
    return [
      {
        sceneId: current.sceneId,
        assetPath: current.assetPath,
        subtitle: current.subtitle,
        subtitlePosition: current.subtitlePosition,
        opacity: 1,
        translateX: 0,
        translateY: 0,
        progressInScene,
        kenBurns: current.kenBurns,
      },
    ];
  }

  const transitionFrames = Math.min(
    durationFrames,
    secondsToFrames(current.transition.durationMs / 1000, fps),
  );
  const transitionStart = current.endFrame - transitionFrames;

  if (transitionFrames <= 0 || clampedFrame < transitionStart) {
    return [
      {
        sceneId: current.sceneId,
        assetPath: current.assetPath,
        subtitle: current.subtitle,
        subtitlePosition: current.subtitlePosition,
        opacity: 1,
        translateX: 0,
        translateY: 0,
        progressInScene,
        kenBurns: current.kenBurns,
      },
    ];
  }

  const t =
    transitionFrames === 0 ? 1 : clamp01((clampedFrame - transitionStart) / transitionFrames);
  const nextDurationFrames = Math.max(1, next.endFrame - next.startFrame);
  const nextProgress = clamp01((clampedFrame - next.startFrame) / nextDurationFrames);

  if (current.transition.type === "cut") {
    return [
      {
        sceneId: current.sceneId,
        assetPath: current.assetPath,
        subtitle: current.subtitle,
        subtitlePosition: current.subtitlePosition,
        opacity: 1,
        translateX: 0,
        translateY: 0,
        progressInScene,
        kenBurns: current.kenBurns,
      },
    ];
  }

  if (current.transition.type === "slide") {
    const direction = current.transition.direction ?? "left";
    const { currentOffset, nextOffset } = computeSlideOffsets(direction, t);
    return [
      {
        sceneId: current.sceneId,
        assetPath: current.assetPath,
        subtitle: current.subtitle,
        subtitlePosition: current.subtitlePosition,
        opacity: 1,
        translateX: currentOffset.x,
        translateY: currentOffset.y,
        progressInScene,
        kenBurns: current.kenBurns,
      },
      {
        sceneId: next.sceneId,
        assetPath: next.assetPath,
        subtitle: next.subtitle,
        subtitlePosition: next.subtitlePosition,
        opacity: 1,
        translateX: nextOffset.x,
        translateY: nextOffset.y,
        progressInScene: nextProgress,
        kenBurns: next.kenBurns,
      },
    ];
  }

  const currentOpacity = 1 - t;
  const nextOpacity = t;
  return [
    {
      sceneId: current.sceneId,
      assetPath: current.assetPath,
      subtitle: current.subtitle,
      subtitlePosition: current.subtitlePosition,
      opacity: currentOpacity,
      translateX: 0,
      translateY: 0,
      progressInScene,
      kenBurns: current.kenBurns,
    },
    {
      sceneId: next.sceneId,
      assetPath: next.assetPath,
      subtitle: next.subtitle,
      subtitlePosition: next.subtitlePosition,
      opacity: nextOpacity,
      translateX: 0,
      translateY: 0,
      progressInScene: nextProgress,
      kenBurns: next.kenBurns,
    },
  ];
};

const findCurrentWindowIndex = (windows: SceneWindow[], frame: number): number => {
  for (let i = 0; i < windows.length; i += 1) {
    const window = windows[i]!;
    if (frame >= window.startFrame && frame < window.endFrame) {
      return i;
    }
  }
  if (frame < windows[0]!.startFrame) {
    return 0;
  }
  return windows.length - 1;
};

const computeSlideOffsets = (
  direction: "left" | "right" | "up" | "down",
  t: number,
): { currentOffset: { x: number; y: number }; nextOffset: { x: number; y: number } } => {
  const screen = 1080;
  const vertical = 1920;
  if (direction === "right") {
    return {
      currentOffset: { x: screen * t, y: 0 },
      nextOffset: { x: -screen * (1 - t), y: 0 },
    };
  }
  if (direction === "up") {
    return {
      currentOffset: { x: 0, y: -vertical * t },
      nextOffset: { x: 0, y: vertical * (1 - t) },
    };
  }
  if (direction === "down") {
    return {
      currentOffset: { x: 0, y: vertical * t },
      nextOffset: { x: 0, y: -vertical * (1 - t) },
    };
  }
  return {
    currentOffset: { x: -screen * t, y: 0 },
    nextOffset: { x: screen * (1 - t), y: 0 },
  };
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const computeKenBurnsTransform = (
  kenBurns: NonNullable<SceneWindow["kenBurns"]>,
  progress: number,
  video: { width: number; height: number } = { width: 1080, height: 1920 },
): { scale: number; translateX: number; translateY: number } => {
  const t = clamp01(progress);
  const scale = lerp(kenBurns.startScale, kenBurns.endScale, t);
  const maxX = Math.max(0, (scale - 1) * video.width * 0.5);
  const maxY = Math.max(0, (scale - 1) * video.height * 0.5);

  const panX =
    kenBurns.panDirection === "left"
      ? -maxX * t
      : kenBurns.panDirection === "right"
        ? maxX * t
        : 0;
  const panY =
    kenBurns.panDirection === "up"
      ? -maxY * t
      : kenBurns.panDirection === "down"
        ? maxY * t
        : 0;

  return {
    scale,
    translateX: panX,
    translateY: panY,
  };
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
