import React from "react";
import { Composition } from "remotion";

import { StoryComposition } from "./StoryComposition.tsx";
import {
  createDefaultStoryTemplateProps,
  StoryTemplatePropsSchema,
} from "./StoryComposition.schema.ts";
import { computeStoryDurationInFrames } from "./StoryComposition.logic.ts";

export const STORY_TEMPLATE_ID = "LihuaCatStoryTemplate";

export const StoryRoot: React.FC = () => {
  const defaultProps = createDefaultStoryTemplateProps();
  const defaultDurationInFrames = computeStoryDurationInFrames(defaultProps, defaultProps.video.fps);
  return (
    <Composition
      id={STORY_TEMPLATE_ID}
      component={StoryComposition}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={defaultDurationInFrames}
      defaultProps={defaultProps}
      schema={StoryTemplatePropsSchema}
      calculateMetadata={({ props }) => {
        const parsed = StoryTemplatePropsSchema.parse(props);
        return {
          durationInFrames: computeStoryDurationInFrames(parsed, parsed.video.fps),
        };
      }}
    />
  );
};
