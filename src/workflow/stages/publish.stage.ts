import type { StoryScript } from "../../contracts/story-script.types.ts";
import type { PublishArtifactsInput } from "../../domains/artifact-publish/publish-artifacts.ts";
import type { RunSummary } from "../../domains/artifact-publish/build-run-summary.ts";
import type { RenderMode } from "../../domains/render-choice/render-choice-machine.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export const runPublishStage = async ({
  runtime,
  mode,
  videoPath,
  generatedCodePath,
  storyScript,
  onProgress,
  publishArtifactsImpl,
}: {
  runtime: WorkflowRuntimeArtifacts;
  mode: RenderMode;
  videoPath: string;
  generatedCodePath?: string;
  storyScript: StoryScript;
  onProgress?: WorkflowProgressReporter;
  publishArtifactsImpl: (
    input: PublishArtifactsInput,
  ) => Promise<RunSummary>;
}): Promise<RunSummary> => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "publish_start",
    message: "Publishing artifacts...",
  });

  const summary = await publishArtifactsImpl({
    runId: runtime.runId,
    outputDir: runtime.outputDir,
    mode,
    videoPath,
    storyScript,
    runLogs: runtime.runLogs,
    errorLogs: runtime.errorLogs,
    generatedCodePath,
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "publish_done",
    message: "Artifacts published.",
  });

  return summary;
};
