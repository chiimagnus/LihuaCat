import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import type { VisualScript } from "../../contracts/visual-script.types.ts";
import type { MidiComposition } from "../../contracts/midi.types.ts";
import type { ReviewLog } from "../../contracts/review-log.types.ts";
import type { OcelotAgentClient } from "../../agents/ocelot/ocelot.client.ts";
import type { KittenAgentClient } from "../../subagents/kitten/kitten.client.ts";
import type { CubAgentClient } from "../../subagents/cub/cub.client.ts";
import type { OcelotCreativeReview } from "../../agents/ocelot/ocelot.validate.ts";
import { runWithProgressHeartbeat } from "./with-progress-heartbeat.ts";

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
  | { type: "ocelot_review_done"; round: number; maxRounds: number; passed: boolean }
  | {
      type: "step_heartbeat";
      round: number;
      maxRounds: number;
      step: "kitten" | "cub" | "ocelot_review";
      elapsedSec: number;
    };

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
    const visualScript = await runWithProgressHeartbeat({
      task: async () =>
        generateKittenVisualScriptWithRetries({
          kittenClient,
          creativePlanRef: storyBriefRef.replace("story-brief.json", "creative-plan.json"),
          creativePlan,
          photos,
          baseRevisionNotes: kittenRevisionNotes,
          maxAttempts: maxKittenAttemptsPerRound,
        }),
      onHeartbeat: (elapsedSec) =>
        onProgress?.({
          type: "step_heartbeat",
          round,
          maxRounds,
          step: "kitten",
          elapsedSec,
        }),
    });
    await onProgress?.({ type: "kitten_generate_done", round, maxRounds });

    await onProgress?.({ type: "cub_generate_start", round, maxRounds });
    let midi: MidiComposition;
    try {
      midi = await runWithProgressHeartbeat({
        task: async () =>
          cubClient.generateMidiJson({
            creativePlanRef: storyBriefRef.replace("story-brief.json", "creative-plan.json"),
            creativePlan,
            revisionNotes: cubRevisionNotes,
          }),
        onHeartbeat: (elapsedSec) =>
          onProgress?.({
            type: "step_heartbeat",
            round,
            maxRounds,
            step: "cub",
            elapsedSec,
          }),
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
    const review = await runWithProgressHeartbeat({
      task: async () =>
        ocelotClient.reviewCreativeAssets!({
          storyBriefRef,
          storyBrief,
          creativePlan,
          visualScript,
          midi,
          round,
          maxRounds,
        }),
      onHeartbeat: (elapsedSec) =>
        onProgress?.({
          type: "step_heartbeat",
          round,
          maxRounds,
          step: "ocelot_review",
          elapsedSec,
        }),
    });
    const normalizedReview = normalizeReviewTargets(review);
    await onProgress?.({
      type: "ocelot_review_done",
      round,
      maxRounds,
      passed: normalizedReview.passed,
    });

    rounds.push({
      round,
      visualScript,
      midi,
      review: normalizedReview,
    });

    if (normalizedReview.passed) {
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

    kittenRevisionNotes = normalizedReview.requiredChanges
      .filter((change) => change.target === "kitten")
      .flatMap((change) => change.instructions);
    cubRevisionNotes = normalizedReview.requiredChanges
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
  const targetDurationSec = creativePlan.musicIntent.durationMs / 1000;

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
        "提醒：video.width=1080、video.height=1920、video.fps=30。",
        "提醒：subtitle 必须是面向观众的叙事句，不能出现时间轴写法（如 10-25秒）或 MIDI/BPM/音轨/乐器术语。",
        `提醒：sum(scenes[].durationSec) 必须精确等于 ${targetDurationSec} 秒（来自 CreativePlan.musicIntent.durationMs），且必须覆盖所有 photoRef。`,
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

const normalizeReviewTargets = (
  review: OcelotCreativeReview,
): OcelotCreativeReview => {
  return {
    ...review,
    issues: review.issues.map((issue) => ({
      ...issue,
      target: normalizeTarget(issue.target, [issue.message]),
    })),
    requiredChanges: review.requiredChanges.map((change) => ({
      ...change,
      target: normalizeTarget(change.target, change.instructions),
    })),
  };
};

const normalizeTarget = (
  current: "kitten" | "cub",
  texts: string[],
): "kitten" | "cub" => {
  const hasMusicHint = texts.some((text) => MUSIC_SIGNAL_RE.test(text));
  const hasVisualHint = texts.some((text) => VISUAL_SIGNAL_RE.test(text));

  if (current === "kitten" && hasMusicHint && !hasVisualHint) {
    return "cub";
  }
  if (current === "cub" && hasVisualHint && !hasMusicHint) {
    return "kitten";
  }
  return current;
};

const MUSIC_SIGNAL_RE =
  /(midi|bpm|track|tracks|note|notes|velocity|chord|melody|harmony|audio|music|drum|piano|guitar|strings|bass|配乐|音乐|音轨|鼓|手鼓|拍掌|木吉他|钢琴|弦乐|贝斯|节奏|音量|高频|低频)/i;

const VISUAL_SIGNAL_RE =
  /(visual|subtitle|scene|scenes|photoRef|kenBurns|transition|镜头|分镜|视觉|字幕|转场|画面|构图|文案)/i;
