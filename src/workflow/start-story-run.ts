import path from "node:path";
import { randomUUID } from "node:crypto";

import type { StoryAgentClient } from "../domains/story-script/story-agent.client.ts";
import type { TabbyAgentClient } from "../domains/tabby/tabby-agent.client.ts";
import type { TabbySessionTui } from "../domains/tabby/tabby-session.ts";
import type { StoryBriefAgentClient } from "../domains/story-brief/story-brief-agent.client.ts";
import type { OcelotAgentClient } from "../domains/render-script/ocelot-agent.client.ts";
import type { RenderMode } from "../domains/render-choice/render-choice-machine.ts";
import type { RunSummary } from "../domains/artifact-publish/build-run-summary.ts";
import type { WorkflowProgressReporter } from "./workflow-events.ts";
import {
  resolveWorkflowPorts,
  resolveWorkflowPortsV2,
  type WorkflowPorts,
  type WorkflowPortsV2,
} from "./workflow-ports.ts";
import { initializeWorkflowRuntime } from "./workflow-runtime.ts";
import { runCollectImagesStage } from "./stages/collect-images.stage.ts";
import { runGenerateScriptStage } from "./stages/generate-script.stage.ts";
import { runRenderStage, runRenderStageV2 } from "./stages/render.stage.ts";
import { runPublishStage } from "./stages/publish.stage.ts";
import { runTabbyStage } from "./stages/tabby.stage.ts";
import { runOcelotStage } from "./stages/ocelot.stage.ts";

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

export type RunStoryWorkflowV2Input = {
  sourceDir: string;
  tabbyAgentClient: TabbyAgentClient;
  tabbyTui: TabbySessionTui;
  storyBriefAgentClient: StoryBriefAgentClient;
  ocelotAgentClient: OcelotAgentClient;
  browserExecutablePath?: string;
  onProgress?: WorkflowProgressReporter;
  now?: Date;
};

export type RunStoryWorkflowV2Dependencies = Partial<WorkflowPortsV2>;

export const runStoryWorkflowV2 = async (
  {
    sourceDir,
    tabbyAgentClient,
    tabbyTui,
    storyBriefAgentClient,
    ocelotAgentClient,
    browserExecutablePath,
    onProgress,
    now,
  }: RunStoryWorkflowV2Input,
  dependencies: RunStoryWorkflowV2Dependencies = {},
): Promise<RunSummary> => {
  const ports = resolveWorkflowPortsV2(dependencies);
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

  const tabby = await runTabbyStage({
    collected,
    runtime,
    tabbyAgentClient,
    tabbyTui,
    storyBriefAgentClient,
    onProgress,
    runTabbySessionImpl: ports.runTabbySessionImpl,
    generateStoryBriefImpl: ports.generateStoryBriefImpl,
  });

  const ocelot = await runOcelotStage({
    collected,
    runtime,
    storyBriefRef: path.join(outputDir, "stages", "story-brief.json"),
    storyBrief: tabby.storyBrief,
    ocelotAgentClient,
    onProgress,
  });

  const rendered = await runRenderStageV2({
    runtime,
    sourceDir,
    collected,
    renderScript: ocelot.renderScript as never,
    browserExecutablePath,
    onProgress,
    renderByTemplateImpl: ports.renderByTemplateImpl,
  });

  return runPublishStage({
    runtime,
    mode: rendered.mode,
    videoPath: rendered.videoPath,
    storyScript: rendered.storyScript,
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
