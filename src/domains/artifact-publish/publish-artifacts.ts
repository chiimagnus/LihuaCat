import fs from "node:fs/promises";
import path from "node:path";

import type { StoryScript } from "../../contracts/story-script.types.ts";
import { buildRunSummary, type RunSummary } from "./build-run-summary.ts";

export type PublishArtifactsInput = {
  runId: string;
  outputDir: string;
  mode: "template" | "ai_code";
  videoPath: string;
  storyScript: StoryScript;
  runLogs: string[];
  errorLogs?: string[];
  generatedCodePath?: string;
};

export const publishArtifacts = async ({
  runId,
  outputDir,
  mode,
  videoPath,
  storyScript,
  runLogs,
  errorLogs = [],
  generatedCodePath,
}: PublishArtifactsInput): Promise<RunSummary> => {
  await fs.mkdir(outputDir, { recursive: true });

  const storyScriptPath = path.join(outputDir, "story-script.json");
  const runLogPath = path.join(outputDir, "run.log");
  const errorLogPath = path.join(outputDir, "error.log");

  await fs.writeFile(storyScriptPath, JSON.stringify(storyScript, null, 2), "utf8");
  await fs.writeFile(runLogPath, runLogs.join("\n"), "utf8");
  if (errorLogs.length > 0) {
    await fs.writeFile(errorLogPath, errorLogs.join("\n"), "utf8");
  }

  return buildRunSummary({
    runId,
    outputDir,
    mode,
    videoPath,
    storyScriptPath,
    runLogPath,
    errorLogPath: errorLogs.length > 0 ? errorLogPath : undefined,
    generatedCodePath,
  });
};
