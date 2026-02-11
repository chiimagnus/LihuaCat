import path from "node:path";
import { randomUUID } from "node:crypto";

import type { TabbyAgentClient } from "../domains/tabby/tabby-agent.client.ts";
import type { TabbySessionTui } from "../domains/tabby/tabby-session.ts";
import type { StoryBriefAgentClient } from "../domains/story-brief/story-brief-agent.client.ts";
import type { OcelotAgentClient } from "../domains/render-script/ocelot-agent.client.ts";
import type { RunSummary } from "../domains/artifact-publish/build-run-summary.ts";
import type { WorkflowProgressReporter } from "./workflow-events.ts";
import {
  resolveWorkflowPorts,
  type WorkflowPorts,
} from "./workflow-ports.ts";
import { initializeWorkflowRuntime } from "./workflow-runtime.ts";
import { runCollectImagesStage } from "./stages/collect-images.stage.ts";
import { runRenderStage } from "./stages/render.stage.ts";
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

export type RunStoryWorkflowV2Dependencies = Partial<WorkflowPorts>;

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
    storyBriefRef: runtime.storyBriefPath,
    storyBrief: tabby.storyBrief,
    ocelotAgentClient,
    onProgress,
  });

  const rendered = await runRenderStage({
    runtime,
    collected,
    renderScript: ocelot.renderScript as never,
    browserExecutablePath,
    onProgress,
    renderByTemplateV2Impl: ports.renderByTemplateV2Impl,
  });

  return runPublishStage({
    runtime,
    videoPath: rendered.videoPath,
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
