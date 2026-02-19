import fs from "node:fs/promises";
import path from "node:path";

import { buildRunSummary, type RunSummary } from "./run-summary.ts";

export type PublishArtifactsInput = {
  runId: string;
  outputDir: string;
  videoPath: string;
  storyBriefPath: string;
  renderScriptPath: string;
  tabbyConversationPath: string;
  ocelotInputPath: string;
  ocelotOutputPath: string;
  ocelotPromptLogPath: string;
  lynxReviewPaths: string[];
  lynxPromptLogPaths: string[];
  ocelotRevisionPaths: string[];
  runLogs: string[];
  errorLogs?: string[];
};

export const publishArtifacts = async ({
  runId,
  outputDir,
  videoPath,
  storyBriefPath,
  renderScriptPath,
  tabbyConversationPath,
  ocelotInputPath,
  ocelotOutputPath,
  ocelotPromptLogPath,
  lynxReviewPaths,
  lynxPromptLogPaths,
  ocelotRevisionPaths,
  runLogs,
  errorLogs = [],
}: PublishArtifactsInput): Promise<RunSummary> => {
  await fs.mkdir(outputDir, { recursive: true });

  const runLogPath = path.join(outputDir, "run.log");
  const errorLogPath = path.join(outputDir, "error.log");

  await fs.writeFile(runLogPath, runLogs.join("\n"), "utf8");
  if (errorLogs.length > 0) {
    await fs.writeFile(errorLogPath, errorLogs.join("\n"), "utf8");
  }

  return buildRunSummary({
    runId,
    outputDir,
    mode: "template",
    videoPath,
    storyBriefPath,
    renderScriptPath,
    tabbyConversationPath,
    runLogPath,
    errorLogPath: errorLogs.length > 0 ? errorLogPath : undefined,
    ocelotInputPath,
    ocelotOutputPath,
    ocelotPromptLogPath,
    lynxReviewPaths,
    lynxPromptLogPaths,
    ocelotRevisionPaths,
  });
};

