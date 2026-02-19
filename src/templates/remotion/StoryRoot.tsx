import React from "react";
import { Composition } from "remotion";

import { StoryComposition } from "./StoryComposition.tsx";
import {
  createDefaultStoryTemplateProps,
  StoryTemplatePropsSchema,
} from "./StoryComposition.schema.ts";

export const STORY_TEMPLATE_ID = "LihuaCatStoryTemplate";

export const StoryRoot: React.FC = () => {
  const defaultProps = createDefaultStoryTemplateProps();
  return (
    <Composition
      id={STORY_TEMPLATE_ID}
      component={StoryComposition}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30 * 30}
      defaultProps={defaultProps}
      schema={StoryTemplatePropsSchema}
    />
  );
};

