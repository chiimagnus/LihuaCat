import type { collectImages } from "../../../tools/material-intake/collect-images.ts";
import type { RenderScript } from "../../../contracts/render-script.types.ts";
import type { renderByTemplateV2 } from "../../../tools/render/render-by-template.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  appendRenderAttempt,
  emitProgressAndPersist,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export const runRenderStage = async ({
  runtime,
  collected,
  renderScript,
  browserExecutablePath,
  onProgress,
  renderByTemplateV2Impl,
}: {
  runtime: WorkflowRuntimeArtifacts;
  collected: Awaited<ReturnType<typeof collectImages>>;
  renderScript: RenderScript;
  browserExecutablePath?: string;
  onProgress?: WorkflowProgressReporter;
  renderByTemplateV2Impl: typeof renderByTemplateV2;
}) => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "render_start",
    message: "Rendering video by template...",
  });

  await appendRenderAttempt(runtime, {
    attempt: 1,
    mode: "template",
    hasAudioTrack: Boolean(renderScript.audioTrack?.path),
    audioTrackPath: renderScript.audioTrack?.path,
    createdAt: new Date().toISOString(),
  });

  try {
    const rendered = await renderByTemplateV2Impl({
      renderScript,
      assets: collected.images.map((image) => ({
        photoRef: image.fileName,
        path: image.absolutePath,
      })),
      outputDir: runtime.outputDir,
      browserExecutablePath,
    });

    await emitProgressAndPersist(runtime, onProgress, {
      stage: "render_success",
      message: "Rendered successfully.",
    });

    return rendered;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "render_failed",
      message,
    });
    throw error;
  }
};
