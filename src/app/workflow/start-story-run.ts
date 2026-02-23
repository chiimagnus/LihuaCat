import path from "node:path";
import { randomUUID } from "node:crypto";

import type { TabbyAgentClient } from "../../agents/tabby/tabby.client.ts";
import type { TabbySessionTui } from "../../agents/tabby/tabby.session.ts";
import type { StoryBriefAgentClient } from "../../subagents/story-brief/story-brief.client.ts";
import type { OcelotAgentClient } from "../../agents/ocelot/ocelot.client.ts";
import type { KittenAgentClient } from "../../agents/kitten/kitten.client.ts";
import type { CubAgentClient } from "../../agents/cub/cub.client.ts";
import type { RunSummary } from "../../tools/artifacts/run-summary.ts";
import type { WorkflowProgressReporter } from "./workflow-events.ts";
import { resolveWorkflowPorts, type WorkflowPorts } from "./workflow-ports.ts";
import { initializeWorkflowRuntime, pushErrorLog } from "./workflow-runtime.ts";
import { runCollectImagesStage } from "./stages/collect-images.stage.ts";
import { runCompressImagesStage } from "./stages/compress-images.stage.ts";
import { runRenderStage } from "./stages/render.stage.ts";
import { runPublishStage } from "./stages/publish.stage.ts";
import { runTabbyStage } from "./stages/tabby.stage.ts";
import { runScriptStage } from "./stages/script.stage.ts";

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
  kittenAgentClient?: KittenAgentClient;
  cubAgentClient?: CubAgentClient;
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
    kittenAgentClient,
    cubAgentClient,
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

  try {
    const collected = await runCollectImagesStage({
      sourceDir,
      runtime,
      onProgress,
      collectImagesImpl: ports.collectImagesImpl,
    });

    const processed = await runCompressImagesStage({
      collected,
      runtime,
      onProgress,
      compressImagesImpl: ports.compressImagesImpl,
    });

    const tabby = await runTabbyStage({
      collected: processed,
      runtime,
      tabbyAgentClient,
      tabbyTui,
      storyBriefAgentClient,
      onProgress,
      runTabbySessionImpl: ports.runTabbySessionImpl,
      generateStoryBriefImpl: ports.generateStoryBriefImpl,
    });

    const script = await runScriptStage({
      collected: processed,
      runtime,
      storyBriefRef: runtime.storyBriefPath,
      storyBrief: tabby.storyBrief,
      ocelotAgentClient,
      kittenAgentClient,
      cubAgentClient,
      runAudioPipelineImpl: ports.runAudioPipelineImpl,
      onProgress,
    });

    const rendered = await runRenderStage({
      runtime,
      collected: processed,
      renderScript: script.renderScript,
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
  } catch (error) {
    if (runtime.errorLogs.length === 0) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      await pushErrorLog(runtime, reason);
      if (error instanceof Error && typeof error.stack === "string") {
        await pushErrorLog(runtime, error.stack);
      }
    }
    throw error;
  }
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
