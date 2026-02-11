import type { StoryTemplateProps } from "./StoryComposition.schema.ts";

export const secondsToFrames = (seconds: number, fps: number): number => {
  return Math.max(1, Math.round(seconds * fps));
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
  if ("storyBriefRef" in props) {
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
  }

  const assetPathById = new Map(
    props.input.assets.map((asset) => [asset.id, asset.path]),
  );
  const subtitleById = new Map(
    props.subtitles.map((subtitle) => [subtitle.id, subtitle.text]),
  );

  return props.timeline.map((item, index): SceneWindow => {
    const assetPath = assetPathById.get(item.assetId) ?? "";
    const subtitle = subtitleById.get(item.subtitleId) ?? "";
    const startFrame = Math.max(0, Math.round(item.startSec * fps));
    const durationInFrames = secondsToFrames(item.endSec - item.startSec, fps);
    const endFrame = startFrame + durationInFrames;
    return {
      sceneId: `${item.assetId}_${index}`,
      startFrame,
      endFrame,
      assetPath,
      subtitle,
      subtitlePosition: "bottom",
      transition: {
        type: "cut",
        durationMs: 0,
      },
    };
  });
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

  const t = transitionFrames === 0 ? 1 : clamp01((clampedFrame - transitionStart) / transitionFrames);
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
