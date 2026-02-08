import type { StoryTemplateProps } from "./StoryComposition.tsx";
import { buildTemplateRenderPlan } from "./StoryComposition.tsx";

export const STORY_TEMPLATE_ID = "LihuaCatStoryTemplate";

export const buildStoryTemplateRoot = (props: StoryTemplateProps) => {
  return {
    compositionId: STORY_TEMPLATE_ID,
    width: props.video.width,
    height: props.video.height,
    fps: props.video.fps,
    durationInFrames: props.video.durationSec * props.video.fps,
    plan: buildTemplateRenderPlan(props),
  };
};
