import type {
  RunSummary,
  TabbyAgentClient,
  StoryBriefAgentClient,
  OcelotAgentClient,
  LynxAgentClient,
  WorkflowProgressEvent,
} from "../../../pipeline.ts";
import {
  runStoryWorkflowV2,
} from "../../../pipeline.ts";
import type { TabbySessionTui } from "../../../agents/tabby/tabby.session.ts";

export type CreateStoryVideoPromptAdapter = {
  askSourceDir: () => Promise<string>;
};

export type CreateStoryVideoFlowInput = {
  prompts: CreateStoryVideoPromptAdapter;
  tabbyAgentClient: TabbyAgentClient;
  tabbyTui: TabbySessionTui;
  storyBriefAgentClient: StoryBriefAgentClient;
  ocelotAgentClient: OcelotAgentClient;
  lynxAgentClient?: LynxAgentClient;
  enableLynxReview?: boolean;
  browserExecutablePath?: string;
  onProgress?: (event: WorkflowProgressEvent) => Promise<void> | void;
  workflowImpl?: typeof runStoryWorkflowV2;
};

export const createStoryVideoFlow = async ({
  prompts,
  tabbyAgentClient,
  tabbyTui,
  storyBriefAgentClient,
  ocelotAgentClient,
  lynxAgentClient,
  enableLynxReview,
  browserExecutablePath,
  onProgress,
  workflowImpl = runStoryWorkflowV2,
}: CreateStoryVideoFlowInput): Promise<RunSummary> => {
  const sourceDir = await prompts.askSourceDir();

  const summary = await workflowImpl({
    sourceDir,
    tabbyAgentClient,
    tabbyTui,
    storyBriefAgentClient,
    ocelotAgentClient,
    lynxAgentClient,
    enableLynxReview,
    browserExecutablePath,
    onProgress,
  });

  return summary;
};
