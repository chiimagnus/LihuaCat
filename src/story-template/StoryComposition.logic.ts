import type { StoryTemplateProps } from "./StoryComposition.schema.ts";

export type StorySequence = {
  key: string;
  from: number;
  durationInFrames: number;
  assetPath: string;
  subtitle: string;
  subtitlePosition: "bottom" | "top" | "center";
};

export const secondsToFrames = (seconds: number, fps: number): number => {
  return Math.max(1, Math.round(seconds * fps));
};

export const buildTemplateSequences = (
  props: StoryTemplateProps,
  fps: number,
): StorySequence[] => {
  if ("storyBriefRef" in props) {
    const assetPathByPhotoRef = new Map(
      props.assets.map((asset) => [asset.photoRef, asset.path]),
    );
    let cursor = 0;
    return props.scenes.map((scene) => {
      const from = cursor;
      const durationInFrames = secondsToFrames(scene.durationSec, fps);
      cursor += durationInFrames;
      return {
        key: scene.sceneId,
        from,
        durationInFrames,
        assetPath: assetPathByPhotoRef.get(scene.photoRef) ?? "",
        subtitle: scene.subtitle,
        subtitlePosition: scene.subtitlePosition,
      };
    });
  }

  const assetPathById = new Map(
    props.input.assets.map((asset) => [asset.id, asset.path]),
  );
  const subtitleById = new Map(
    props.subtitles.map((subtitle) => [subtitle.id, subtitle.text]),
  );

  return props.timeline.map((item, index) => {
    const assetPath = assetPathById.get(item.assetId) ?? "";
    const subtitle = subtitleById.get(item.subtitleId) ?? "";
    const from = Math.max(0, Math.round(item.startSec * fps));
    const durationInFrames = secondsToFrames(item.endSec - item.startSec, fps);
    return {
      key: `${item.assetId}_${index}`,
      from,
      durationInFrames,
      assetPath,
      subtitle,
      subtitlePosition: "bottom",
    };
  });
};
