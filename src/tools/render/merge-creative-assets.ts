import type { RenderAudioTrack, RenderScript } from "../../contracts/render-script.types.ts";
import {
  validateVisualScript,
  type VisualScript,
} from "../../contracts/visual-script.types.ts";

export class MergeCreativeAssetsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MergeCreativeAssetsError";
  }
}

export const mergeCreativeAssets = ({
  storyBriefRef,
  visualScript,
  audioTrack,
}: {
  storyBriefRef: string;
  visualScript: VisualScript;
  audioTrack?: RenderAudioTrack;
}): RenderScript => {
  const validation = validateVisualScript(visualScript);
  if (!validation.valid || !validation.script) {
    throw new MergeCreativeAssetsError(
      `visual-script invalid: ${validation.errors.join("; ")}`,
    );
  }

  const merged: RenderScript = {
    storyBriefRef,
    video: { ...validation.script.video },
    scenes: validation.script.scenes.map((scene) => ({
      ...scene,
      transition: { ...scene.transition },
      kenBurns: scene.kenBurns ? { ...scene.kenBurns } : undefined,
    })),
    ...(audioTrack ? { audioTrack: { ...audioTrack } } : {}),
  };

  return merged;
};

