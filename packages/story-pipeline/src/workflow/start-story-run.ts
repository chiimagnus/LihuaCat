import path from "node:path";
import { randomUUID } from "node:crypto";

import type { StoryAgentClient } from "../domains/story-script/story-agent.client.ts";
import type { RenderMode } from "../domains/render-choice/render-choice-machine.ts";
import type { RunSummary } from "../domains/artifact-publish/build-run-summary.ts";
import type { WorkflowProgressReporter } from "./workflow-events.ts";
import { resolveWorkflowPorts, type WorkflowPorts } from "./workflow-ports.ts";
import { initializeWorkflowRuntime } from "./workflow-runtime.ts";
import { runCollectImagesStage } from "./stages/collect-images.stage.ts";
import { runGenerateScriptStage } from "./stages/generate-script.stage.ts";
import { runRenderStage } from "./stages/render.stage.ts";
import { runPublishStage } from "./stages/publish.stage.ts";

export type { WorkflowProgressEvent } from "./workflow-events.ts";

export type StartStoryRunInput = {
  sourceDir: string;
  now?: Date;
};

export type StartStoryRunResult = {
  runId: string;
  outputDir: string;
};

export type RunStoryWorkflowInput = {
  sourceDir: string;
  storyAgentClient: StoryAgentClient;
  browserExecutablePath?: string;
  style: {
    preset: string;
    prompt?: string;
  };
  chooseRenderMode: (state: {
    lastFailure?: { mode: RenderMode; reason: string };
  }) => Promise<RenderMode | "exit">;
  onRenderFailure?: (input: {
    mode: RenderMode;
    reason: string;
  }) => Promise<void> | void;
  onProgress?: WorkflowProgressReporter;
  now?: Date;
};

export type RunStoryWorkflowDependencies = Partial<WorkflowPorts>;

export const startStoryRun = ({
  sourceDir,
  now = new Date(),
}: StartStoryRunInput): StartStoryRunResult => {
  const timestamp = formatTimestamp(now);
  const runId = `${timestamp}-${randomUUID().slice(0, 8)}`;
  return {
    runId,
    outputDir: path.join(sourceDir, "lihuacat-output", runId),
  };
};

export const runStoryWorkflow = async (
  {
    sourceDir,
    storyAgentClient,
    browserExecutablePath,
    style,
    chooseRenderMode,
    onRenderFailure,
    onProgress,
    now,
  }: RunStoryWorkflowInput,
  dependencies: RunStoryWorkflowDependencies = {},
): Promise<RunSummary> => {
  const ports = resolveWorkflowPorts(dependencies);
  const { runId, outputDir } = startStoryRun({
    sourceDir,
    now,
  });
  const runtime = await initializeWorkflowRuntime({
    runId,
    sourceDir,
    outputDir,
  });

  const collected = await runCollectImagesStage({
    sourceDir,
    runtime,
    onProgress,
    collectImagesImpl: ports.collectImagesImpl,
  });
  const scriptResult = await runGenerateScriptStage({
    sourceDir,
    style,
    storyAgentClient,
    collected,
    runtime,
    onProgress,
    generateStoryScriptImpl: ports.generateStoryScriptImpl,
  });
  const renderResult = await runRenderStage({
    runtime,
    storyScript: scriptResult.script,
    browserExecutablePath,
    chooseRenderMode,
    onRenderFailure,
    onProgress,
    renderByTemplateImpl: ports.renderByTemplateImpl,
    renderByAiCodeImpl: ports.renderByAiCodeImpl,
  });

  return runPublishStage({
    runtime,
    mode: renderResult.mode,
    videoPath: renderResult.videoPath,
    generatedCodePath: renderResult.generatedCodePath,
    storyScript: scriptResult.script,
    onProgress,
    publishArtifactsImpl: ports.publishArtifactsImpl,
  });
};

const formatTimestamp = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
};
