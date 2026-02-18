export type RunSummaryInput = {
  runId: string;
  outputDir: string;
  mode: "template";
  videoPath: string;
  storyBriefPath: string;
  renderScriptPath: string;
  tabbyConversationPath: string;
  runLogPath: string;
  errorLogPath?: string;
  ocelotInputPath: string;
  ocelotOutputPath: string;
  ocelotPromptLogPath: string;
  lynxReviewPaths: string[];
  lynxPromptLogPaths: string[];
  ocelotRevisionPaths: string[];
};

export type RunSummary = RunSummaryInput;

export const buildRunSummary = (input: RunSummaryInput): RunSummary => input;
