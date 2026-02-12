import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  appendRenderAttempt,
  emitProgressAndPersist,
  pushErrorLog,
  pushRunLog,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { renderByTemplateV2 } from "../../domains/template-render/render-by-template.ts";

export type RenderStageResult = {
  mode: "template";
  videoPath: string;
};

export const runRenderStage = async ({
  runtime,
  collected,
  renderScript,
  browserExecutablePath,
  onProgress,
  renderByTemplateV2Impl,
}: {
  runtime: WorkflowRuntimeArtifacts;
  collected: { images: Array<{ fileName: string; absolutePath: string }> };
  renderScript: RenderScript;
  browserExecutablePath?: string;
  onProgress?: WorkflowProgressReporter;
  renderByTemplateV2Impl: typeof renderByTemplateV2;
}): Promise<RenderStageResult> => {
  await pushRunLog(runtime, "modeSelected=template");
  await appendRenderAttempt(runtime, {
    time: new Date().toISOString(),
    mode: "template",
    status: "started",
  });
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "render_start",
    message: "Rendering video with template mode...",
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
    await appendRenderAttempt(runtime, {
      time: new Date().toISOString(),
      mode: "template",
      status: "success",
      videoPath: rendered.videoPath,
    });
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "render_success",
      message: "Template render succeeded.",
    });
    return {
      mode: "template",
      videoPath: rendered.videoPath,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await pushErrorLog(runtime, `[template] ${reason}`);
    await appendRenderAttempt(runtime, {
      time: new Date().toISOString(),
      mode: "template",
      status: "failed",
      reason,
    });
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "render_failed",
      message: `Template render failed: ${reason}`,
    });
    throw error;
  }
};
