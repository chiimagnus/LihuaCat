export type RunSummaryInput = {
  runId: string;
  outputDir: string;
  mode: "template";
  videoPath: string;
  storyBriefPath: string;
  creativePlanPath?: string;
  visualScriptPath?: string;
  reviewLogPath?: string;
  midiJsonPath?: string;
  musicMidPath?: string;
  musicWavPath?: string;
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
