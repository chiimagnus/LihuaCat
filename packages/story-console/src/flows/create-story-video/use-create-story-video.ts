import type { StoryAgentClient } from "../../../../story-pipeline/src/domains/story-script/story-agent.client.ts";
import { createStoryVideoFlow, type CreateStoryVideoPromptAdapter } from "./create-story-video.flow.ts";

export const useCreateStoryVideo = (storyAgentClient: StoryAgentClient) => {
  return {
    run: (prompts: CreateStoryVideoPromptAdapter) =>
      createStoryVideoFlow({
        prompts,
        storyAgentClient,
      }),
  };
};
