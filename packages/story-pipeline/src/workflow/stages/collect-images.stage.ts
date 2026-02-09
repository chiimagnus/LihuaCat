import type { collectImages } from "../../domains/material-intake/collect-images.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeStageArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export const runCollectImagesStage = async ({
  sourceDir,
  runtime,
  onProgress,
  collectImagesImpl,
}: {
  sourceDir: string;
  runtime: WorkflowRuntimeArtifacts;
  onProgress?: WorkflowProgressReporter;
  collectImagesImpl: typeof collectImages;
}) => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "collect_images_start",
    message: "Collecting images from input directory...",
  });

  const collected = await collectImagesImpl({
    sourceDir,
    maxImages: 20,
  });

  await pushRunLog(runtime, `collectedImages=${collected.images.length}`);
  await writeStageArtifact(runtime, "material-intake.json", {
    sourceDir,
    imageCount: collected.images.length,
    images: collected.images,
  });
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "collect_images_done",
    message: `Collected ${collected.images.length} images.`,
  });

  return collected;
};
