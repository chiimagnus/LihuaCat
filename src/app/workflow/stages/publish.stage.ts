import type { PublishArtifactsInput } from "../../../tools/artifacts/publish-artifacts.ts";
import type { RunSummary } from "../../../tools/artifacts/run-summary.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export const runPublishStage = async ({
  runtime,
  videoPath,
  onProgress,
  publishArtifactsImpl,
}: {
  runtime: WorkflowRuntimeArtifacts;
  videoPath: string;
  onProgress?: WorkflowProgressReporter;
  publishArtifactsImpl: (input: PublishArtifactsInput) => Promise<RunSummary>;
}): Promise<RunSummary> => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "publish_start",
    message: "Publishing artifacts...",
  });

  const summary = await publishArtifactsImpl({
    runId: runtime.runId,
    outputDir: runtime.outputDir,
    videoPath,
    storyBriefPath: runtime.storyBriefPath,
    renderScriptPath: runtime.renderScriptPath,
    tabbyConversationPath: runtime.tabbyConversationPath,
    ocelotInputPath: runtime.ocelotInputPath,
    ocelotOutputPath: runtime.ocelotOutputPath,
    ocelotPromptLogPath: runtime.ocelotPromptLogPath,
    lynxReviewPaths: runtime.lynxReviewPaths,
    lynxPromptLogPaths: runtime.lynxPromptLogPaths,
    ocelotRevisionPaths: runtime.ocelotRevisionPaths,
    runLogs: runtime.runLogs,
    errorLogs: runtime.errorLogs,
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "publish_done",
    message: "Artifacts published.",
  });

  return summary;
};

