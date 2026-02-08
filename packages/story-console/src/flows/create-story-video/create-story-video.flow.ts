import type { RunSummary } from "../../../../story-pipeline/src/domains/artifact-publish/build-run-summary.ts";
import type { StoryAgentClient } from "../../../../story-pipeline/src/domains/story-script/story-agent.client.ts";
import type { RenderMode } from "../../../../story-pipeline/src/domains/render-choice/render-choice-machine.ts";
import { runStoryWorkflow } from "../../../../story-pipeline/src/workflow/start-story-run.ts";

export type CreateStoryVideoPromptAdapter = {
  askSourceDir: () => Promise<string>;
  askStylePreset: () => Promise<string>;
  askPrompt: () => Promise<string>;
  chooseRenderMode: (state: {
    lastFailure?: { mode: RenderMode; reason: string };
  }) => Promise<RenderMode | "exit">;
};

export type CreateStoryVideoFlowInput = {
  prompts: CreateStoryVideoPromptAdapter;
  storyAgentClient: StoryAgentClient;
  workflowImpl?: typeof runStoryWorkflow;
};

export const createStoryVideoFlow = async ({
  prompts,
  storyAgentClient,
  workflowImpl = runStoryWorkflow,
}: CreateStoryVideoFlowInput): Promise<RunSummary> => {
  const sourceDir = await prompts.askSourceDir();
  const preset = await prompts.askStylePreset();
  const prompt = await prompts.askPrompt();

  const summary = await workflowImpl({
    sourceDir,
    style: {
      preset,
      prompt: prompt.trim().length > 0 ? prompt : undefined,
    },
    storyAgentClient,
    chooseRenderMode: prompts.chooseRenderMode,
  });

  return summary;
};
