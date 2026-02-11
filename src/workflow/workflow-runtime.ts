import fs from "node:fs/promises";
import path from "node:path";

import type { StoryScript } from "../contracts/story-script.types.ts";
import type { StoryBrief } from "../contracts/story-brief.types.ts";
import type { RenderScript } from "../contracts/render-script.types.ts";
import type {
  WorkflowProgressEvent,
  WorkflowProgressReporter,
} from "./workflow-events.ts";

export type WorkflowRuntimeArtifacts = {
  runId: string;
  sourceDir: string;
  outputDir: string;
  stageDir: string;
  runLogPath: string;
  errorLogPath: string;
  storyScriptPath: string;
  storyBriefPath: string;
  renderScriptPath: string;
  tabbyConversationPath: string;
  ocelotInputPath: string;
  ocelotOutputPath: string;
  ocelotPromptLogPath: string;
  progressEventsPath: string;
  renderAttemptsPath: string;
  runLogs: string[];
  errorLogs: string[];
};

export const initializeWorkflowRuntime = async ({
  runId,
  sourceDir,
  outputDir,
}: {
  runId: string;
  sourceDir: string;
  outputDir: string;
}): Promise<WorkflowRuntimeArtifacts> => {
  const stageDir = path.join(outputDir, "stages");
  const runtime: WorkflowRuntimeArtifacts = {
    runId,
    sourceDir,
    outputDir,
    stageDir,
    runLogPath: path.join(outputDir, "run.log"),
    errorLogPath: path.join(outputDir, "error.log"),
    storyScriptPath: path.join(outputDir, "story-script.json"),
    storyBriefPath: path.join(outputDir, "story-brief.json"),
    renderScriptPath: path.join(outputDir, "render-script.json"),
    tabbyConversationPath: path.join(outputDir, "tabby-conversation.jsonl"),
    ocelotInputPath: path.join(outputDir, "ocelot-input.json"),
    ocelotOutputPath: path.join(outputDir, "ocelot-output.json"),
    ocelotPromptLogPath: path.join(outputDir, "ocelot-prompt.log"),
    progressEventsPath: path.join(stageDir, "progress-events.jsonl"),
    renderAttemptsPath: path.join(stageDir, "render-attempts.jsonl"),
    runLogs: [],
    errorLogs: [],
  };

  await fs.mkdir(runtime.stageDir, { recursive: true });
  await pushRunLog(runtime, `runId=${runtime.runId}`);
  await pushRunLog(runtime, `sourceDir=${runtime.sourceDir}`);
  await writeStageArtifact(runtime, "run-context.json", {
    runId: runtime.runId,
    sourceDir: runtime.sourceDir,
    outputDir: runtime.outputDir,
    createdAt: new Date().toISOString(),
  });

  return runtime;
};

export const emitProgressAndPersist = async (
  runtime: WorkflowRuntimeArtifacts,
  onProgress: WorkflowProgressReporter | undefined,
  event: WorkflowProgressEvent,
) => {
  if (onProgress) {
    await onProgress(event);
  }
  await appendJsonLine(runtime.progressEventsPath, {
    time: new Date().toISOString(),
    stage: event.stage,
    message: event.message,
  });
};

export const pushRunLog = async (
  runtime: WorkflowRuntimeArtifacts,
  line: string,
) => {
  runtime.runLogs.push(line);
  await fs.appendFile(runtime.runLogPath, `${line}\n`, "utf8");
};

export const pushErrorLog = async (
  runtime: WorkflowRuntimeArtifacts,
  line: string,
) => {
  runtime.errorLogs.push(line);
  await fs.appendFile(runtime.errorLogPath, `${line}\n`, "utf8");
};

export const writeStoryScriptArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  storyScript: StoryScript,
) => {
  await fs.writeFile(
    runtime.storyScriptPath,
    JSON.stringify(storyScript, null, 2),
    "utf8",
  );
};

export const writeStoryBriefArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  storyBrief: StoryBrief,
) => {
  await fs.writeFile(
    runtime.storyBriefPath,
    JSON.stringify(storyBrief, null, 2),
    "utf8",
  );
};

export const writeRenderScriptArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  renderScript: RenderScript,
) => {
  await fs.writeFile(
    runtime.renderScriptPath,
    JSON.stringify(renderScript, null, 2),
    "utf8",
  );
};

export const writeStageArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  fileName: string,
  data: unknown,
) => {
  await fs.writeFile(
    path.join(runtime.stageDir, fileName),
    JSON.stringify(data, null, 2),
    "utf8",
  );
};

export const appendRenderAttempt = async (
  runtime: WorkflowRuntimeArtifacts,
  data: Record<string, unknown>,
) => {
  await appendJsonLine(runtime.renderAttemptsPath, data);
};

const appendJsonLine = async (filePath: string, data: Record<string, unknown>) => {
  await fs.appendFile(filePath, `${JSON.stringify(data)}\n`, "utf8");
};
