export {
  runStoryWorkflow,
  startStoryRun,
  type RunStoryWorkflowInput,
  type RunStoryWorkflowDependencies,
  type StartStoryRunInput,
  type StartStoryRunResult,
  type WorkflowProgressEvent,
} from "./workflow/start-story-run.ts";

export type { RunSummary } from "./domains/artifact-publish/build-run-summary.ts";

export type {
  StoryAgentClient,
  GenerateStoryScriptRequest,
  CreateCodexStoryAgentClientInput,
} from "./domains/story-script/story-agent.client.ts";
export {
  createCodexStoryAgentClient,
  DEFAULT_CODEX_MODEL,
  DEFAULT_CODEX_REASONING_EFFORT,
  StoryAgentResponseParseError,
} from "./domains/story-script/story-agent.client.ts";

export { StoryScriptGenerationFailedError } from "./domains/story-script/generate-story-script.ts";
export { SourceDirectoryNotFoundError } from "./domains/material-intake/material-intake.errors.ts";

export type { RenderMode } from "./domains/render-choice/render-choice-machine.ts";
