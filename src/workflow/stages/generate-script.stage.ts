import type { StoryAgentClient } from "../../domains/story-script/story-agent.client.ts";
import type { collectImages } from "../../domains/material-intake/collect-images.ts";
import type { generateStoryScript } from "../../domains/story-script/generate-story-script.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeStageArtifact,
  writeStoryScriptArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export const runGenerateScriptStage = async ({
  sourceDir,
  style,
  storyAgentClient,
  collected,
  runtime,
  onProgress,
  generateStoryScriptImpl,
}: {
  sourceDir: string;
  style: {
    preset: string;
    prompt?: string;
  };
  storyAgentClient: StoryAgentClient;
  collected: Awaited<ReturnType<typeof collectImages>>;
  runtime: WorkflowRuntimeArtifacts;
  onProgress?: WorkflowProgressReporter;
  generateStoryScriptImpl: typeof generateStoryScript;
}) => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "generate_script_start",
    message: "Generating story script with Codex...",
  });

  const scriptResult = await generateStoryScriptImpl({
    sourceDir,
    style,
    client: storyAgentClient,
    assets: collected.images.map((image, index) => ({
      id: `img_${String(index + 1).padStart(3, "0")}`,
      path: image.absolutePath,
    })),
    maxRetries: 2,
    constraints: {
      durationSec: 30,
      minDurationPerAssetSec: 1,
      requireAllAssetsUsed: true,
    },
  });

  await pushRunLog(
    runtime,
    `storyScriptGeneratedInAttempts=${scriptResult.attempts}`,
  );
  await writeStoryScriptArtifact(runtime, scriptResult.script);
  await writeStageArtifact(runtime, "story-script-generated.json", {
    attempts: scriptResult.attempts,
    generatedAt: new Date().toISOString(),
  });
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "generate_script_done",
    message: `Story script ready (attempts=${scriptResult.attempts}).`,
  });

  return scriptResult;
};
