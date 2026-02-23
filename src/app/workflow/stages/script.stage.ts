import type { collectImages } from "../../../tools/material-intake/collect-images.ts";
import type { OcelotAgentClient } from "../../../agents/ocelot/ocelot.client.ts";
import type { KittenAgentClient } from "../../../agents/kitten/kitten.client.ts";
import type { CubAgentClient } from "../../../agents/cub/cub.client.ts";
import type { StoryBrief } from "../../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../../contracts/render-script.types.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeCreativePlanArtifact,
  writeMidiJsonArtifact,
  writeRenderScriptArtifact,
  writeReviewLogArtifact,
  writeStageArtifact,
  writeVisualScriptArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";
import {
  reviseCreativeAssetsWithOcelot,
  type ReviseCreativeAssetsWithOcelotProgressEvent,
} from "../revise-creative-assets-with-ocelot.ts";
import { mergeCreativeAssets } from "../../../tools/render/merge-creative-assets.ts";

const truncateForUi = (value: string): string => {
  if (value.length <= 120) return value;
  return `${value.slice(0, 120)}...`;
};

export const runScriptStage = async ({
  collected,
  runtime,
  storyBriefRef,
  storyBrief,
  ocelotAgentClient,
  kittenAgentClient,
  cubAgentClient,
  enableLynxReview,
  onProgress,
}: {
  collected: Awaited<ReturnType<typeof collectImages>>;
  runtime: WorkflowRuntimeArtifacts;
  storyBriefRef: string;
  storyBrief: StoryBrief;
  ocelotAgentClient: OcelotAgentClient;
  kittenAgentClient?: KittenAgentClient;
  cubAgentClient?: CubAgentClient;
  enableLynxReview?: boolean;
  onProgress?: WorkflowProgressReporter;
}): Promise<{ renderScript: RenderScript; finalPassed: boolean; rounds: number }> => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "script_start",
    message: "Generating RenderScript...",
  });

  const photos = collected.images.map((image) => ({
    photoRef: image.fileName,
    path: image.absolutePath,
  }));

  const video = { width: 1080, height: 1920, fps: 30 };

  if (kittenAgentClient && cubAgentClient) {
    const toCreativeProgressMessage = (
      event: ReviseCreativeAssetsWithOcelotProgressEvent,
    ): string => {
      if (event.type === "round_start") {
        return `Ocelot creative review: round ${event.round}/${event.maxRounds}`;
      }
      if (event.type === "kitten_generate_start") {
        return `Round ${event.round} · Kitten generating visual script...`;
      }
      if (event.type === "kitten_generate_done") {
        return `Round ${event.round} · Kitten visual script ready`;
      }
      if (event.type === "cub_generate_start") {
        return `Round ${event.round} · Cub generating MIDI JSON...`;
      }
      if (event.type === "cub_generate_done") {
        return `Round ${event.round} · Cub MIDI JSON ready`;
      }
      if (event.type === "ocelot_review_start") {
        return `Round ${event.round} · Ocelot reviewing creative assets...`;
      }
      return `Round ${event.round} · Ocelot review ${event.passed ? "passed" : "needs changes"}`;
    };

    const creative = await reviseCreativeAssetsWithOcelot({
      storyBriefRef,
      storyBrief,
      photos,
      ocelotClient: ocelotAgentClient,
      kittenClient: kittenAgentClient,
      cubClient: cubAgentClient,
      maxRounds: 3,
      onProgress: async (event) => {
        await emitProgressAndPersist(runtime, onProgress, {
          stage: "script_progress",
          message: toCreativeProgressMessage(event),
        });
      },
    });

    const renderScript = mergeCreativeAssets({
      storyBriefRef,
      visualScript: creative.visualScript,
    });

    await writeCreativePlanArtifact(runtime, creative.creativePlan);
    await writeVisualScriptArtifact(runtime, creative.visualScript);
    await writeReviewLogArtifact(runtime, creative.reviewLog);
    await writeMidiJsonArtifact(runtime, creative.midi);
    await writeRenderScriptArtifact(runtime, renderScript);
    await writeStageArtifact(runtime, "creative-plan.json", creative.creativePlan);
    await writeStageArtifact(runtime, "visual-script.json", creative.visualScript);
    await writeStageArtifact(runtime, "review-log.json", creative.reviewLog);
    await writeStageArtifact(runtime, "music-json.json", creative.midi);
    await writeStageArtifact(runtime, "render-script.json", renderScript);
    await writeStageArtifact(runtime, "script-stage.json", {
      mode: "ocelot-creative-director",
      rounds: creative.rounds.length,
      finalPassed: creative.finalPassed,
      warning: creative.warning,
      createdAt: new Date().toISOString(),
    });
    await pushRunLog(runtime, "scriptMode=ocelot-creative-director");
    await pushRunLog(runtime, `creativeReviewRounds=${creative.rounds.length}`);
    await pushRunLog(runtime, `creativeReviewFinalPassed=${creative.finalPassed}`);
    if (creative.warning) {
      await pushRunLog(runtime, `warning=${creative.warning}`);
      await emitProgressAndPersist(runtime, onProgress, {
        stage: "script_warning",
        message: creative.warning,
      });
    }

    await emitProgressAndPersist(runtime, onProgress, {
      stage: "script_done",
      message: `RenderScript ready (creative rounds=${creative.rounds.length}, passed=${creative.finalPassed}).`,
    });

    return {
      renderScript,
      finalPassed: creative.finalPassed,
      rounds: creative.rounds.length,
    };
  }

  if (enableLynxReview) {
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "script_warning",
      message: "Lynx review has been removed. Continue with Ocelot-only script generation.",
    });
  }

  const reasons: string[] = [];
  const maxAttempts = 3;
  let revisionNotes: string[] | undefined = undefined;

  const generateOnce = async () =>
    ocelotAgentClient.generateRenderScript({
      storyBriefRef,
      storyBrief,
      photos,
      video,
      revisionNotes,
      debug: {
        inputPath: runtime.ocelotInputPath,
        outputPath: runtime.ocelotOutputPath,
        promptLogPath: runtime.ocelotPromptLogPath,
      },
    });

  let renderScript: RenderScript | undefined = undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await emitProgressAndPersist(runtime, onProgress, {
      stage: "script_progress",
      message: `Generating RenderScript... (attempt ${attempt}/${maxAttempts})`,
    });
    try {
      renderScript = await generateOnce();
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await emitProgressAndPersist(runtime, onProgress, {
        stage: "script_progress",
        message: `RenderScript invalid, retrying... (attempt ${attempt}/${maxAttempts}) · ${truncateForUi(message)}`,
      });
      reasons.push(`attempt ${attempt}: ${message}`);
      if (attempt >= maxAttempts) {
        throw error;
      }

      revisionNotes = [
        ...(revisionNotes ?? []),
        "Previous attempt failed automated validation. Fix all validation errors and return a fully valid RenderScript JSON.",
        `Validation error: ${message}`,
        "Reminder: you MUST use every provided photoRef at least once in scenes[].photoRef.",
      ];
    }
  }

  if (!renderScript) {
    throw new Error(
      `Unexpected: failed to generate renderScript. Reasons: ${reasons.join(" | ")}`,
    );
  }

  await pushRunLog(runtime, "scriptMode=ocelot-legacy-render-script");
  await pushRunLog(runtime, `renderScriptGeneratedInAttempts=${reasons.length + 1}`);

  await writeRenderScriptArtifact(runtime, renderScript);
  await writeStageArtifact(runtime, "render-script.json", renderScript);
  await writeStageArtifact(runtime, "script-stage.json", {
    mode: "ocelot-legacy-render-script",
    rounds: 1,
    finalPassed: true,
    attempts: reasons.length + 1,
    createdAt: new Date().toISOString(),
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "script_done",
    message: "RenderScript ready.",
  });

  return {
    renderScript,
    finalPassed: true,
    rounds: 1,
  };
};
