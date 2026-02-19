import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { LynxReview } from "../../contracts/lynx-review.types.ts";
import type { OcelotAgentClient } from "../../agents/ocelot/ocelot.client.ts";
import type { LynxAgentClient } from "../../agents/lynx/lynx.client.ts";

export type ReviseRenderScriptWithLynxInput = {
  storyBriefRef: string;
  storyBrief: StoryBrief;
  photos: Array<{ photoRef: string; path: string }>;
  video: { width: number; height: number; fps: number };
  ocelotClient: OcelotAgentClient;
  lynxClient: LynxAgentClient;
  maxRounds?: number;
  maxOcelotRetriesPerRound?: number;
  onProgress?: (event: ReviseRenderScriptWithLynxProgressEvent) => Promise<void> | void;
};

export type RenderScriptRevisionRound = {
  round: number;
  renderScript: RenderScript;
  lynxReview: LynxReview;
};

export type ReviseRenderScriptWithLynxResult = {
  finalScript: RenderScript;
  finalPassed: boolean;
  rounds: RenderScriptRevisionRound[];
};

export type ReviseRenderScriptWithLynxProgressEvent =
  | {
      type: "round_start";
      round: number;
      maxRounds: number;
    }
  | {
      type: "ocelot_attempt_start";
      round: number;
      attempt: number;
      maxAttempts: number;
    }
  | {
      type: "ocelot_attempt_failed";
      round: number;
      attempt: number;
      maxAttempts: number;
      errorMessage: string;
    }
  | {
      type: "lynx_review_start";
      round: number;
      maxRounds: number;
    }
  | {
      type: "lynx_review_done";
      round: number;
      maxRounds: number;
      passed: boolean;
    };

export class RenderScriptGenerationFailedError extends Error {
  public readonly round: number;
  public readonly attempts: number;
  public readonly reasons: string[];

  constructor(round: number, attempts: number, reasons: string[]) {
    super(`RenderScript generation failed in round ${round} after ${attempts} attempts`);
    this.name = "RenderScriptGenerationFailedError";
    this.round = round;
    this.attempts = attempts;
    this.reasons = reasons;
  }
}

export const reviseRenderScriptWithLynx = async ({
  storyBriefRef,
  storyBrief,
  photos,
  video,
  ocelotClient,
  lynxClient,
  maxRounds = 3,
  maxOcelotRetriesPerRound = 2,
  onProgress,
}: ReviseRenderScriptWithLynxInput): Promise<ReviseRenderScriptWithLynxResult> => {
  const rounds: RenderScriptRevisionRound[] = [];
  let revisionNotes: string[] | undefined = undefined;

  const generateWithRetries = async (
    round: number,
    notes: string[] | undefined,
  ): Promise<RenderScript> => {
    const reasons: string[] = [];
    const maxAttempts = maxOcelotRetriesPerRound + 1;
    let mergedNotes = notes;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await onProgress?.({ type: "ocelot_attempt_start", round, attempt, maxAttempts });
      try {
        return await ocelotClient.generateRenderScript({
          storyBriefRef,
          storyBrief,
          photos,
          video,
          revisionNotes: mergedNotes,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await onProgress?.({
          type: "ocelot_attempt_failed",
          round,
          attempt,
          maxAttempts,
          errorMessage: message,
        });
        reasons.push(`attempt ${attempt}: ${message}`);
        if (attempt >= maxAttempts) {
          throw new RenderScriptGenerationFailedError(round, maxAttempts, reasons);
        }

        const lastReason = reasons[reasons.length - 1] ?? message;
        mergedNotes = [
          ...(notes ?? []),
          "Previous attempt failed automated validation. Fix all validation errors and return a fully valid RenderScript JSON.",
          `Validation error: ${lastReason}`,
          "Reminder: you MUST use every provided photoRef at least once in scenes[].photoRef.",
        ];
      }
    }

    throw new Error("Unexpected: exceeded maxAttempts without returning or throwing");
  };

  for (let round = 1; round <= maxRounds; round += 1) {
    await onProgress?.({ type: "round_start", round, maxRounds });
    const renderScript = await generateWithRetries(round, revisionNotes);

    await onProgress?.({ type: "lynx_review_start", round, maxRounds });
    const lynxReview = await lynxClient.reviewRenderScript({
      storyBriefRef,
      storyBrief,
      renderScriptRef: undefined,
      renderScript,
      round,
      maxRounds,
    });

    rounds.push({ round, renderScript, lynxReview });

    await onProgress?.({
      type: "lynx_review_done",
      round,
      maxRounds,
      passed: lynxReview.passed,
    });

    if (lynxReview.passed) {
      return {
        finalScript: renderScript,
        finalPassed: true,
        rounds,
      };
    }

    revisionNotes = lynxReview.requiredChanges;
  }

  const last = rounds[rounds.length - 1];
  if (!last) {
    throw new Error("Unexpected: no revision rounds were executed");
  }

  return {
    finalScript: last.renderScript,
    finalPassed: false,
    rounds,
  };
};

