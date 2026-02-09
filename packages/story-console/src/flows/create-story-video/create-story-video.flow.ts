import type {
  RunSummary,
  StoryAgentClient,
  RenderMode,
  WorkflowProgressEvent,
} from "../../../../story-pipeline/src/index.ts";
import {
  runStoryWorkflow,
} from "../../../../story-pipeline/src/index.ts";

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
  browserExecutablePath?: string;
  onProgress?: (event: WorkflowProgressEvent) => Promise<void> | void;
  workflowImpl?: typeof runStoryWorkflow;
};

export const createStoryVideoFlow = async ({
  prompts,
  storyAgentClient,
  browserExecutablePath,
  onProgress,
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
    browserExecutablePath,
    chooseRenderMode: prompts.chooseRenderMode,
    onProgress,
  });

  return summary;
};
