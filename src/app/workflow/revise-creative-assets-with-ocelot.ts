import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import type { VisualScript } from "../../contracts/visual-script.types.ts";
import type { MidiComposition } from "../../contracts/midi.types.ts";
import type { ReviewLog } from "../../contracts/review-log.types.ts";
import type { OcelotAgentClient } from "../../agents/ocelot/ocelot.client.ts";
import type { KittenAgentClient } from "../../subagents/kitten/kitten.client.ts";
import type { CubAgentClient } from "../../subagents/cub/cub.client.ts";
import type { OcelotCreativeReview } from "../../agents/ocelot/ocelot.validate.ts";

export type CreativeRevisionRound = {
  round: number;
  visualScript: VisualScript;
  midi: MidiComposition;
  review: OcelotCreativeReview;
};

export type ReviseCreativeAssetsWithOcelotResult = {
  creativePlan: CreativePlan;
  visualScript: VisualScript;
  midi: MidiComposition;
  audioAvailable: boolean;
  finalPassed: boolean;
  warning?: string;
  rounds: CreativeRevisionRound[];
  reviewLog: ReviewLog;
};

export type ReviseCreativeAssetsWithOcelotProgressEvent =
  | { type: "round_start"; round: number; maxRounds: number }
  | { type: "kitten_generate_start"; round: number; maxRounds: number }
  | { type: "kitten_generate_done"; round: number; maxRounds: number }
  | { type: "cub_generate_start"; round: number; maxRounds: number }
  | { type: "cub_generate_done"; round: number; maxRounds: number }
  | { type: "ocelot_review_start"; round: number; maxRounds: number }
  | { type: "ocelot_review_done"; round: number; maxRounds: number; passed: boolean };

export const reviseCreativeAssetsWithOcelot = async ({
  storyBriefRef,
  storyBrief,
  photos,
  ocelotClient,
  kittenClient,
  cubClient,
  maxRounds = 3,
  allowCubFallback = true,
  onProgress,
}: {
  storyBriefRef: string;
  storyBrief: StoryBrief;
  photos: Array<{ photoRef: string; path: string }>;
  ocelotClient: OcelotAgentClient;
  kittenClient: KittenAgentClient;
  cubClient: CubAgentClient;
  maxRounds?: number;
  allowCubFallback?: boolean;
  onProgress?: (event: ReviseCreativeAssetsWithOcelotProgressEvent) => Promise<void> | void;
}): Promise<ReviseCreativeAssetsWithOcelotResult> => {
  if (!ocelotClient.generateCreativePlan || !ocelotClient.reviewCreativeAssets) {
    throw new Error("Ocelot creative director methods are not available.");
  }

  const creativePlan = await ocelotClient.generateCreativePlan({
    storyBriefRef,
    storyBrief,
    photos,
  });

  const rounds: CreativeRevisionRound[] = [];
  let kittenRevisionNotes: string[] | undefined = undefined;
  let cubRevisionNotes: string[] | undefined = undefined;
  const maxKittenAttemptsPerRound = 3;

  for (let round = 1; round <= maxRounds; round += 1) {
    await onProgress?.({ type: "round_start", round, maxRounds });

    await onProgress?.({ type: "kitten_generate_start", round, maxRounds });
    const visualScript = await generateKittenVisualScriptWithRetries({
      kittenClient,
      creativePlanRef: storyBriefRef.replace("story-brief.json", "creative-plan.json"),
      creativePlan,
      photos,
      baseRevisionNotes: kittenRevisionNotes,
      maxAttempts: maxKittenAttemptsPerRound,
    });
    await onProgress?.({ type: "kitten_generate_done", round, maxRounds });

    await onProgress?.({ type: "cub_generate_start", round, maxRounds });
    let midi: MidiComposition;
    try {
      midi = await cubClient.generateMidiJson({
        creativePlanRef: storyBriefRef.replace("story-brief.json", "creative-plan.json"),
        creativePlan,
        revisionNotes: cubRevisionNotes,
      });
    } catch (error) {
      if (!allowCubFallback) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      const warning = `Cub generation failed in round ${round}; fallback to no-music render. reason: ${reason}`;
      const fallbackRound: CreativeRevisionRound = {
        round,
        visualScript,
        midi: createSilentMidiFromCreativePlan(creativePlan),
        review: {
          passed: false,
          summary: warning,
          issues: [{ target: "cub", message: reason }],
          requiredChanges: [],
        },
      };
      const fallbackRounds = [...rounds, fallbackRound];
      return {
        creativePlan,
        visualScript,
        midi: fallbackRound.midi,
        audioAvailable: false,
        finalPassed: false,
        warning,
        rounds: fallbackRounds,
        reviewLog: toReviewLog({
          rounds: fallbackRounds,
          maxRounds,
          finalPassed: false,
          warning,
        }),
      };
    }
    await onProgress?.({ type: "cub_generate_done", round, maxRounds });

    await onProgress?.({ type: "ocelot_review_start", round, maxRounds });
    const review = await ocelotClient.reviewCreativeAssets({
      storyBriefRef,
      storyBrief,
      creativePlan,
      visualScript,
      midi,
      round,
      maxRounds,
    });
    await onProgress?.({ type: "ocelot_review_done", round, maxRounds, passed: review.passed });

    rounds.push({
      round,
      visualScript,
      midi,
      review,
    });

    if (review.passed) {
      return {
        creativePlan,
        visualScript,
        midi,
        audioAvailable: true,
        finalPassed: true,
        rounds,
        reviewLog: toReviewLog({ rounds, maxRounds, finalPassed: true }),
      };
    }

    kittenRevisionNotes = review.requiredChanges
      .filter((change) => change.target === "kitten")
      .flatMap((change) => change.instructions);
    cubRevisionNotes = review.requiredChanges
      .filter((change) => change.target === "cub")
      .flatMap((change) => change.instructions);
  }

  const lastRound = rounds[rounds.length - 1];
  if (!lastRound) {
    throw new Error("Unexpected: no creative revision rounds executed");
  }

  const warning = `Ocelot review reached maxRounds=${maxRounds}; continue with latest creative assets.`;
  return {
    creativePlan,
    visualScript: lastRound.visualScript,
    midi: lastRound.midi,
    audioAvailable: true,
    finalPassed: false,
    warning,
    rounds,
    reviewLog: toReviewLog({
      rounds,
      maxRounds,
      finalPassed: false,
      warning,
    }),
  };
};

const generateKittenVisualScriptWithRetries = async ({
  kittenClient,
  creativePlanRef,
  creativePlan,
  photos,
  baseRevisionNotes,
  maxAttempts,
}: {
  kittenClient: KittenAgentClient;
  creativePlanRef: string;
  creativePlan: CreativePlan;
  photos: Array<{ photoRef: string; path: string }>;
  baseRevisionNotes?: string[];
  maxAttempts: number;
}): Promise<VisualScript> => {
  let revisionNotes = baseRevisionNotes ? [...baseRevisionNotes] : undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await kittenClient.generateVisualScript({
        creativePlanRef,
        creativePlan,
        photos,
        revisionNotes,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        throw error;
      }

      const reason = error instanceof Error ? error.message : String(error);
      revisionNotes = [
        ...(revisionNotes ?? []),
        "上一次输出未通过自动校验，请只返回合法的 VisualScript JSON。",
        `自动校验错误：${reason}`,
        "提醒：sum(scenes[].durationSec) 必须精确等于 30 秒，且必须覆盖所有 photoRef。",
      ];
    }
  }

  throw (lastError instanceof Error
    ? lastError
    : new Error("Unexpected: kitten generation retries exhausted"));
};

const createSilentMidiFromCreativePlan = (creativePlan: CreativePlan): MidiComposition => {
  const durationMs = Math.max(1, creativePlan.musicIntent.durationMs);
  return {
    bpm: 90,
    timeSignature: "4/4",
    durationMs,
    tracks: [
      { name: "Piano", channel: 0, program: 0, notes: [] },
      { name: "Strings", channel: 1, program: 48, notes: [] },
      { name: "Bass", channel: 2, program: 33, notes: [] },
      { name: "Drums", channel: 9, program: 0, notes: [] },
    ],
  };
};

const toReviewLog = ({
  rounds,
  maxRounds,
  finalPassed,
  warning,
}: {
  rounds: CreativeRevisionRound[];
  maxRounds: number;
  finalPassed: boolean;
  warning?: string;
}): ReviewLog => {
  return {
    reviewer: "ocelot",
    maxRounds,
    finalPassed,
    ...(warning ? { warning } : {}),
    rounds: rounds.map((round) => ({
      round: round.round,
      passed: round.review.passed,
      summary: round.review.summary,
      issues: round.review.issues.map((issue) => ({
        target: issue.target,
        message: issue.message,
      })),
      requiredChanges: round.review.requiredChanges.map((change) => ({
        target: change.target,
        instructions: [...change.instructions],
      })),
    })),
  };
};
