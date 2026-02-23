import fs from "node:fs/promises";
import path from "node:path";

import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import type { VisualScript } from "../../contracts/visual-script.types.ts";
import type { ReviewLog } from "../../contracts/review-log.types.ts";
import type { MidiComposition } from "../../contracts/midi.types.ts";
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
  storyBriefPath: string;
  creativePlanPath: string;
  visualScriptPath: string;
  reviewLogPath: string;
  midiJsonPath: string;
  musicMidPath: string;
  musicWavPath: string;
  renderScriptPath: string;
  tabbyConversationPath: string;
  ocelotInputPath: string;
  ocelotOutputPath: string;
  ocelotPromptLogPath: string;
  lynxReviewPaths: string[];
  ocelotRevisionPaths: string[];
  lynxPromptLogPaths: string[];
  getLynxReviewPath: (round: number) => string;
  getOcelotRevisionPath: (round: number) => string;
  getLynxPromptLogPath: (round: number) => string;
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
  const getLynxReviewPath = (round: number) =>
    path.join(outputDir, `lynx-review-${String(round)}.json`);
  const getOcelotRevisionPath = (round: number) =>
    path.join(outputDir, `ocelot-revision-${String(round)}.json`);
  const getLynxPromptLogPath = (round: number) =>
    path.join(outputDir, `lynx-prompt-${String(round)}.log`);

  const runtime: WorkflowRuntimeArtifacts = {
    runId,
    sourceDir,
    outputDir,
    stageDir,
    runLogPath: path.join(outputDir, "run.log"),
    errorLogPath: path.join(outputDir, "error.log"),
    storyBriefPath: path.join(outputDir, "story-brief.json"),
    creativePlanPath: path.join(outputDir, "creative-plan.json"),
    visualScriptPath: path.join(outputDir, "visual-script.json"),
    reviewLogPath: path.join(outputDir, "review-log.json"),
    midiJsonPath: path.join(outputDir, "music-json.json"),
    musicMidPath: path.join(outputDir, "music.mid"),
    musicWavPath: path.join(outputDir, "music.wav"),
    renderScriptPath: path.join(outputDir, "render-script.json"),
    tabbyConversationPath: path.join(outputDir, "tabby-conversation.jsonl"),
    ocelotInputPath: path.join(outputDir, "ocelot-input.json"),
    ocelotOutputPath: path.join(outputDir, "ocelot-output.json"),
    ocelotPromptLogPath: path.join(outputDir, "ocelot-prompt.log"),
    lynxReviewPaths: [],
    ocelotRevisionPaths: [],
    lynxPromptLogPaths: [],
    getLynxReviewPath,
    getOcelotRevisionPath,
    getLynxPromptLogPath,
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

export const pushRunLog = async (runtime: WorkflowRuntimeArtifacts, line: string) => {
  runtime.runLogs.push(line);
  await fs.appendFile(runtime.runLogPath, `${line}\n`, "utf8");
};

export const pushErrorLog = async (runtime: WorkflowRuntimeArtifacts, line: string) => {
  runtime.errorLogs.push(line);
  await fs.appendFile(runtime.errorLogPath, `${line}\n`, "utf8");
};

export const writeStoryBriefArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  storyBrief: StoryBrief,
) => {
  await fs.writeFile(runtime.storyBriefPath, JSON.stringify(storyBrief, null, 2), "utf8");
};

export const writeCreativePlanArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  creativePlan: CreativePlan,
) => {
  await fs.writeFile(runtime.creativePlanPath, JSON.stringify(creativePlan, null, 2), "utf8");
};

export const writeVisualScriptArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  visualScript: VisualScript,
) => {
  await fs.writeFile(runtime.visualScriptPath, JSON.stringify(visualScript, null, 2), "utf8");
};

export const writeReviewLogArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  reviewLog: ReviewLog,
) => {
  await fs.writeFile(runtime.reviewLogPath, JSON.stringify(reviewLog, null, 2), "utf8");
};

export const writeMidiJsonArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  midiJson: MidiComposition,
) => {
  await fs.writeFile(runtime.midiJsonPath, JSON.stringify(midiJson, null, 2), "utf8");
};

export const writeRenderScriptArtifact = async (
  runtime: WorkflowRuntimeArtifacts,
  renderScript: RenderScript,
) => {
  await fs.writeFile(runtime.renderScriptPath, JSON.stringify(renderScript, null, 2), "utf8");
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
