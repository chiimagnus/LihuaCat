import type { collectImages } from "../../tools/material-intake/collect-images.ts";
import type { compressImagesToRemotionPublicDir } from "../../tools/material-intake/compress-images.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeStageArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export const runCompressImagesStage = async ({
  collected,
  runtime,
  onProgress,
  compressImagesImpl,
}: {
  collected: Awaited<ReturnType<typeof collectImages>>;
  runtime: WorkflowRuntimeArtifacts;
  onProgress?: WorkflowProgressReporter;
  compressImagesImpl: typeof compressImagesToRemotionPublicDir;
}) => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "compress_images_start",
    message: "Compressing images for Tabby/Ocelot/Render...",
  });

  const result = await compressImagesImpl({
    images: collected.images,
    outputDir: runtime.outputDir,
    targetBytes: 300 * 1024,
  });

  const warningCount = result.report.filter((item) => item.warning).length;
  await pushRunLog(runtime, `compressedImages=${result.images.length}`);
  await pushRunLog(runtime, `compressedWarnings=${warningCount}`);

  await writeStageArtifact(runtime, "compress-images.json", {
    targetBytes: 300 * 1024,
    publicDir: result.publicDir,
    stagedDir: result.stagedDir,
    warningCount,
    images: result.report,
    createdAt: new Date().toISOString(),
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "compress_images_done",
    message: `Compressed ${result.images.length} images${warningCount ? ` (warnings=${warningCount})` : ""}.`,
  });

  return {
    ...collected,
    images: result.images,
  };
};
