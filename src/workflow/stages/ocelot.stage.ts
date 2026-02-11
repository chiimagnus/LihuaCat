import type { collectImages } from "../../domains/material-intake/collect-images.ts";
import type { OcelotAgentClient } from "../../domains/render-script/ocelot-agent.client.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeStageArtifact,
  writeRenderScriptArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export type OcelotStageResult = {
  renderScript: unknown;
};

export const runOcelotStage = async ({
  collected,
  runtime,
  storyBriefRef,
  storyBrief,
  ocelotAgentClient,
  onProgress,
}: {
  collected: Awaited<ReturnType<typeof collectImages>>;
  runtime: WorkflowRuntimeArtifacts;
  storyBriefRef: string;
  storyBrief: unknown;
  ocelotAgentClient: OcelotAgentClient;
  onProgress?: WorkflowProgressReporter;
}): Promise<OcelotStageResult> => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "ocelot_start",
    message: "Ocelot is writing render script...",
  });

  const photos = collected.images.map((image) => ({
    photoRef: image.fileName,
    path: image.absolutePath,
  }));

  const renderScript = await ocelotAgentClient.generateRenderScript({
    storyBriefRef,
    storyBrief: storyBrief as never,
    photos,
    video: { width: 1080, height: 1920, fps: 30 },
    attempt: 1,
    previousErrors: [],
    debug: {
      inputPath: runtime.ocelotInputPath,
      outputPath: runtime.ocelotOutputPath,
      promptLogPath: runtime.ocelotPromptLogPath,
    },
  });

  await pushRunLog(runtime, "renderScriptGeneratedInAttempts=1");
  await writeRenderScriptArtifact(runtime, renderScript);
  await writeStageArtifact(runtime, "render-script.json", renderScript);

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "ocelot_done",
    message: "RenderScript ready.",
  });

  return { renderScript };
};
