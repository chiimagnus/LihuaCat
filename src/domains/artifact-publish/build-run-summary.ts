export type RunSummaryInput = {
  runId: string;
  outputDir: string;
  mode: "template" | "ai_code";
  videoPath: string;
  storyScriptPath: string;
  runLogPath: string;
  errorLogPath?: string;
  generatedCodePath?: string;
};

export type RunSummary = RunSummaryInput;

export const buildRunSummary = (input: RunSummaryInput): RunSummary => input;
