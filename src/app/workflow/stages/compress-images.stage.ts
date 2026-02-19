import type { collectImages } from "../../../tools/material-intake/collect-images.ts";
import type { compressImagesToRemotionPublicDir } from "../../../tools/material-intake/compress-images.ts";
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
    message: "Compressing images for remotion...",
  });

  const compressed = await compressImagesImpl({
    images: collected.images,
    outputDir: runtime.outputDir,
  });

  await pushRunLog(runtime, `stagedAssetsDir=${compressed.stagedDir}`);
  await writeStageArtifact(runtime, "compress-images.json", compressed.report);

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "compress_images_done",
    message: `Compressed ${compressed.images.length} images.`,
  });

  return {
    sourceDir: collected.sourceDir,
    images: compressed.images.map((image) => ({
      index: image.index,
      fileName: image.fileName,
      absolutePath: image.absolutePath,
      extension: image.extension,
    })),
  };
};
