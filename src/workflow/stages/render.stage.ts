import type { StoryScript } from "../../contracts/story-script.types.ts";
import { RenderChoiceMachine, type RenderMode } from "../../domains/render-choice/render-choice-machine.ts";
import type { renderByTemplate } from "../../domains/template-render/render-by-template.ts";
import type { renderByAiCode } from "../../domains/ai-code-render/render-by-ai-code.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  appendRenderAttempt,
  emitProgressAndPersist,
  pushErrorLog,
  pushRunLog,
  writeStoryScriptArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";

export type RenderStageResult = {
  mode: RenderMode;
  videoPath: string;
  generatedCodePath?: string;
};

export const runRenderStage = async ({
  runtime,
  storyScript,
  browserExecutablePath,
  chooseRenderMode,
  onRenderFailure,
  onProgress,
  renderByTemplateImpl,
  renderByAiCodeImpl,
}: {
  runtime: WorkflowRuntimeArtifacts;
  storyScript: StoryScript;
  browserExecutablePath?: string;
  chooseRenderMode: (state: {
    lastFailure?: { mode: RenderMode; reason: string };
  }) => Promise<RenderMode | "exit">;
  onRenderFailure?: (input: {
    mode: RenderMode;
    reason: string;
  }) => Promise<void> | void;
  onProgress?: WorkflowProgressReporter;
  renderByTemplateImpl: typeof renderByTemplate;
  renderByAiCodeImpl: typeof renderByAiCode;
}): Promise<RenderStageResult> => {
  const machine = new RenderChoiceMachine();
  let generatedCodePath: string | undefined;

  while (machine.getState().phase !== "completed") {
    const state = machine.getState();
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "choose_mode",
      message:
        state.phase === "select_mode" && state.lastFailure
          ? `Select render mode again (last failure: ${state.lastFailure.mode}).`
          : "Selecting render mode...",
    });

    const mode = await chooseRenderMode({
      lastFailure: state.phase === "select_mode" ? state.lastFailure : undefined,
    });

    if (mode === "exit") {
      await pushRunLog(runtime, "modeSelected=exit");
      if (state.phase === "select_mode" && state.lastFailure) {
        throw new Error(
          `Run exited after render failure (${state.lastFailure.mode}): ${state.lastFailure.reason}`,
        );
      }
      throw new Error("Run exited by user before successful rendering.");
    }

    machine.selectMode(mode);
    await pushRunLog(runtime, `modeSelected=${mode}`);
    await appendRenderAttempt(runtime, {
      time: new Date().toISOString(),
      mode,
      status: "started",
    });
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "render_start",
      message:
        mode === "template"
          ? "Rendering video with template mode..."
          : "Rendering video with AI code mode...",
    });

    if (mode === "template") {
      await runTemplateAttempt({
        machine,
        runtime,
        storyScript,
        browserExecutablePath,
        onRenderFailure,
        onProgress,
        renderByTemplateImpl,
      });
      continue;
    }

    const aiRenderResult = await runAiCodeAttempt({
      machine,
      runtime,
      storyScript,
      browserExecutablePath,
      onRenderFailure,
      onProgress,
      renderByAiCodeImpl,
    });
    if (aiRenderResult.generatedCodePath) {
      generatedCodePath = aiRenderResult.generatedCodePath;
    }
  }

  const completedState = machine.getState();
  if (completedState.phase !== "completed") {
    throw new Error("Internal workflow error: run finished without completion");
  }

  return {
    mode: completedState.mode,
    videoPath: completedState.videoPath,
    generatedCodePath,
  };
};

export type RenderStageV2Result = {
  mode: "template";
  videoPath: string;
  storyScript: StoryScript;
};

export const runRenderStageV2 = async ({
  runtime,
  sourceDir,
  collected,
  renderScript,
  browserExecutablePath,
  onProgress,
  renderByTemplateImpl,
}: {
  runtime: WorkflowRuntimeArtifacts;
  sourceDir: string;
  collected: { images: Array<{ fileName: string; absolutePath: string }> };
  renderScript: RenderScript;
  browserExecutablePath?: string;
  onProgress?: WorkflowProgressReporter;
  renderByTemplateImpl: typeof renderByTemplate;
}): Promise<RenderStageV2Result> => {
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

  const storyScript = buildStoryScriptForTemplate({
    sourceDir,
    collected,
    renderScript,
  });
  await writeStoryScriptArtifact(runtime, storyScript);

  try {
    const rendered = await renderByTemplateImpl({
      storyScript,
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
      storyScript,
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

const buildStoryScriptForTemplate = ({
  sourceDir,
  collected,
  renderScript,
}: {
  sourceDir: string;
  collected: { images: Array<{ fileName: string; absolutePath: string }> };
  renderScript: RenderScript;
}): StoryScript => {
  const assets = collected.images.map((image, index) => ({
    id: `img_${String(index + 1).padStart(3, "0")}`,
    path: image.absolutePath,
  }));

  const assetIdByPhotoRef = new Map<string, string>();
  for (let i = 0; i < collected.images.length; i += 1) {
    const image = collected.images[i]!;
    assetIdByPhotoRef.set(image.fileName, assets[i]!.id);
  }

  let cursorSec = 0;
  const timeline: StoryScript["timeline"] = [];
  const subtitles: StoryScript["subtitles"] = [];

  for (let i = 0; i < renderScript.scenes.length; i += 1) {
    const scene = renderScript.scenes[i]!;
    const assetId = assetIdByPhotoRef.get(scene.photoRef);
    if (!assetId) {
      throw new Error(`render-script references unknown photoRef: ${scene.photoRef}`);
    }
    const subtitleId = `sub_${String(i + 1).padStart(3, "0")}`;
    const startSec = cursorSec;
    const endSec = cursorSec + scene.durationSec;
    cursorSec = endSec;
    timeline.push({
      assetId,
      startSec,
      endSec,
      subtitleId,
    });
    subtitles.push({
      id: subtitleId,
      text: scene.subtitle,
      startSec,
      endSec,
    });
  }

  return {
    version: "1.0",
    input: {
      sourceDir,
      imageCount: assets.length,
      assets,
    },
    video: {
      width: renderScript.video.width,
      height: renderScript.video.height,
      fps: renderScript.video.fps,
      durationSec: 30,
    },
    style: {
      preset: "tabby",
    },
    timeline,
    subtitles,
  };
};

const runTemplateAttempt = async ({
  machine,
  runtime,
  storyScript,
  browserExecutablePath,
  onRenderFailure,
  onProgress,
  renderByTemplateImpl,
}: {
  machine: RenderChoiceMachine;
  runtime: WorkflowRuntimeArtifacts;
  storyScript: StoryScript;
  browserExecutablePath?: string;
  onRenderFailure?: (input: {
    mode: RenderMode;
    reason: string;
  }) => Promise<void> | void;
  onProgress?: WorkflowProgressReporter;
  renderByTemplateImpl: typeof renderByTemplate;
}) => {
  try {
    const rendered = await renderByTemplateImpl({
      storyScript,
      outputDir: runtime.outputDir,
      browserExecutablePath,
    });
    machine.markSuccess(rendered.videoPath);
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
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await pushErrorLog(runtime, `[template] ${reason}`);
    await appendRenderAttempt(runtime, {
      time: new Date().toISOString(),
      mode: "template",
      status: "failed",
      reason,
    });
    machine.markFailure(reason);
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "render_failed",
      message: `Template render failed: ${reason}`,
    });
    if (onRenderFailure) {
      await onRenderFailure({
        mode: "template",
        reason,
      });
    }
  }
};

const runAiCodeAttempt = async ({
  machine,
  runtime,
  storyScript,
  browserExecutablePath,
  onRenderFailure,
  onProgress,
  renderByAiCodeImpl,
}: {
  machine: RenderChoiceMachine;
  runtime: WorkflowRuntimeArtifacts;
  storyScript: StoryScript;
  browserExecutablePath?: string;
  onRenderFailure?: (input: {
    mode: RenderMode;
    reason: string;
  }) => Promise<void> | void;
  onProgress?: WorkflowProgressReporter;
  renderByAiCodeImpl: typeof renderByAiCode;
}): Promise<{ generatedCodePath?: string }> => {
  const rendered = await renderByAiCodeImpl({
    storyScript,
    outputDir: runtime.outputDir,
    browserExecutablePath,
  });

  if (!rendered.ok) {
    const reason = `${rendered.error.stage}: ${rendered.error.message}${
      rendered.error.details ? ` | ${rendered.error.details}` : ""
    }`;
    await pushErrorLog(runtime, `[ai_code] ${reason}`);
    await appendRenderAttempt(runtime, {
      time: new Date().toISOString(),
      mode: "ai_code",
      status: "failed",
      reason,
      generatedCodePath: rendered.generatedCodeDir,
    });
    machine.markFailure(reason);
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "render_failed",
      message: `AI code render failed: ${reason}`,
    });
    if (onRenderFailure) {
      await onRenderFailure({
        mode: "ai_code",
        reason,
      });
    }
    return {
      generatedCodePath: rendered.generatedCodeDir,
    };
  }

  machine.markSuccess(rendered.videoPath);
  await appendRenderAttempt(runtime, {
    time: new Date().toISOString(),
    mode: "ai_code",
    status: "success",
    videoPath: rendered.videoPath,
    generatedCodePath: rendered.generatedCodeDir,
  });
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "render_success",
    message: "AI code render succeeded.",
  });
  return {
    generatedCodePath: rendered.generatedCodeDir,
  };
};
