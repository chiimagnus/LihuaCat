import fs from "node:fs/promises";

import type { collectImages } from "../../tools/material-intake/collect-images.ts";
import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { OcelotAgentClient } from "../../agents/ocelot/ocelot.client.ts";
import type { LynxAgentClient } from "../../agents/lynx/lynx.client.ts";
import {
  reviseRenderScriptWithLynx,
  type ReviseRenderScriptWithLynxProgressEvent,
} from "../../domains/render-script/revise-render-script-with-lynx.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeRenderScriptArtifact,
  writeStageArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export type ScriptStageResult = {
  renderScript: RenderScript;
  finalPassed: boolean;
  rounds: number;
};

export const runScriptStage = async ({
  collected,
  runtime,
  storyBriefRef,
  storyBrief,
  ocelotAgentClient,
  lynxAgentClient,
  enableLynxReview = false,
  onProgress,
  maxRounds = 3,
}: {
  collected: Awaited<ReturnType<typeof collectImages>>;
  runtime: WorkflowRuntimeArtifacts;
  storyBriefRef: string;
  storyBrief: StoryBrief;
  ocelotAgentClient: OcelotAgentClient;
  lynxAgentClient?: LynxAgentClient;
  enableLynxReview?: boolean;
  onProgress?: WorkflowProgressReporter;
  maxRounds?: number;
}): Promise<ScriptStageResult> => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "script_start",
    message: enableLynxReview
      ? "Generating RenderScript with Lynx review loop..."
      : "Generating RenderScript...",
  });

  const photos = collected.images.map((image) => ({
    photoRef: image.fileName,
    path: image.absolutePath,
  }));

  const video = { width: 1080, height: 1920, fps: 30 };

  if (!enableLynxReview) {
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
      throw new Error(`Unexpected: failed to generate renderScript. Reasons: ${reasons.join(" | ")}`);
    }

    await pushRunLog(runtime, "lynxReviewEnabled=false");
    await pushRunLog(runtime, `renderScriptGeneratedInAttempts=${reasons.length + 1}`);

    await writeRenderScriptArtifact(runtime, renderScript);
    await writeStageArtifact(runtime, "render-script.json", renderScript);
    await writeStageArtifact(runtime, "script-stage.json", {
      lynxEnabled: false,
      rounds: 1,
      finalPassed: true,
      attempts: reasons.length + 1,
      createdAt: new Date().toISOString(),
    });

    await emitProgressAndPersist(runtime, onProgress, {
      stage: "script_done",
      message: "RenderScript ready (lynx=disabled).",
    });

    return {
      renderScript,
      finalPassed: true,
      rounds: 1,
    };
  }

  if (!lynxAgentClient) {
    throw new Error("Lynx review is enabled but lynxAgentClient is not provided.");
  }

  const emitLynxProgress = async (message: string) =>
    emitProgressAndPersist(runtime, onProgress, {
      stage: "script_progress",
      message,
    });

  const toLynxProgressMessage = (event: ReviseRenderScriptWithLynxProgressEvent): string => {
    if (event.type === "round_start") {
      return `Lynx review: round ${event.round}/${event.maxRounds} · generating RenderScript...`;
    }
    if (event.type === "ocelot_attempt_start") {
      return `Round ${event.round} · generating RenderScript (attempt ${event.attempt}/${event.maxAttempts})...`;
    }
    if (event.type === "ocelot_attempt_failed") {
      return `Round ${event.round} · validation failed (attempt ${event.attempt}/${event.maxAttempts}), retrying... · ${truncateForUi(event.errorMessage)}`;
    }
    if (event.type === "lynx_review_start") {
      return `Round ${event.round} · Lynx reviewing...`;
    }
    if (event.type === "lynx_review_done") {
      return `Round ${event.round} · Lynx review ${event.passed ? "passed" : "found issues"}...`;
    }
    return "Lynx review: working...";
  };

  const result = await reviseRenderScriptWithLynx({
    storyBriefRef,
    storyBrief,
    photos,
    video,
    ocelotClient: {
      async generateRenderScript(request) {
        return ocelotAgentClient.generateRenderScript({
          ...request,
          debug: {
            inputPath: runtime.ocelotInputPath,
            outputPath: runtime.ocelotOutputPath,
            promptLogPath: runtime.ocelotPromptLogPath,
          },
        });
      },
    },
    lynxClient: {
      async reviewRenderScript(request) {
        const promptLogPath = runtime.getLynxPromptLogPath(request.round);
        runtime.lynxPromptLogPaths.push(promptLogPath);
        return lynxAgentClient.reviewRenderScript({
          ...request,
          debug: { promptLogPath },
        });
      },
    },
    maxRounds,
    maxOcelotRetriesPerRound: 2,
    onProgress: async (event) => {
      await emitLynxProgress(toLynxProgressMessage(event));
    },
  });

  for (const round of result.rounds) {
    const ocelotRevisionPath = runtime.getOcelotRevisionPath(round.round);
    runtime.ocelotRevisionPaths.push(ocelotRevisionPath);
    await fs.writeFile(
      ocelotRevisionPath,
      JSON.stringify(round.renderScript, null, 2),
      "utf8",
    );

    const lynxReviewPath = runtime.getLynxReviewPath(round.round);
    runtime.lynxReviewPaths.push(lynxReviewPath);
    await fs.writeFile(
      lynxReviewPath,
      JSON.stringify(round.lynxReview, null, 2),
      "utf8",
    );
  }

  await pushRunLog(runtime, `renderScriptGeneratedInAttempts=${result.rounds.length}`);
  await pushRunLog(runtime, "lynxReviewEnabled=true");
  await pushRunLog(runtime, `lynxReviewRounds=${result.rounds.length}`);
  await pushRunLog(runtime, `lynxFinalPassed=${result.finalPassed}`);

  await writeRenderScriptArtifact(runtime, result.finalScript);
  await writeStageArtifact(runtime, "render-script.json", result.finalScript);
  await writeStageArtifact(runtime, "script-stage.json", {
    lynxEnabled: true,
    rounds: result.rounds.length,
    finalPassed: result.finalPassed,
    createdAt: new Date().toISOString(),
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "script_done",
    message: `RenderScript ready (rounds=${result.rounds.length}, passed=${result.finalPassed}).`,
  });

  return {
    renderScript: result.finalScript,
    finalPassed: result.finalPassed,
    rounds: result.rounds.length,
  };
};

const truncateForUi = (input: string, maxLen = 120): string => {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLen - 1))}…`;
};
