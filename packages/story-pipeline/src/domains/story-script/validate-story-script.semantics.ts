import type {
  StoryScript,
  StoryScriptValidationResult,
} from "../../contracts/story-script.types.ts";

export type StoryScriptSemanticRules = {
  expectedDurationSec?: number;
  minDurationPerAssetSec?: number;
  requireAllAssetsUsed?: boolean;
};

export const validateStoryScriptSemantics = (
  script: StoryScript,
  rules: StoryScriptSemanticRules = {},
): StoryScriptValidationResult => {
  const expectedDurationSec = rules.expectedDurationSec ?? 30;
  const minDurationPerAssetSec = rules.minDurationPerAssetSec ?? 1;
  const requireAllAssetsUsed = rules.requireAllAssetsUsed ?? true;

  const errors: string[] = [];

  const totalDuration = script.timeline.reduce(
    (sum, item) => sum + (item.endSec - item.startSec),
    0,
  );

  if (!isApproximatelyEqual(totalDuration, expectedDurationSec, 1e-6)) {
    errors.push(
      `timeline total duration must be ${expectedDurationSec}, got ${totalDuration}`,
    );
  }

  for (let i = 0; i < script.timeline.length; i += 1) {
    const item = script.timeline[i]!;
    const duration = item.endSec - item.startSec;
    if (duration < minDurationPerAssetSec) {
      errors.push(
        `timeline[${i}] duration must be >= ${minDurationPerAssetSec}, got ${duration}`,
      );
    }
    if (item.endSec <= item.startSec) {
      errors.push(`timeline[${i}] endSec must be > startSec`);
    }
  }

  if (requireAllAssetsUsed) {
    const assetIds = new Set(script.input.assets.map((asset) => asset.id));
    const usedAssetIds = new Set(script.timeline.map((item) => item.assetId));
    for (const assetId of assetIds) {
      if (!usedAssetIds.has(assetId)) {
        errors.push(`asset ${assetId} is not used in timeline`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const isApproximatelyEqual = (a: number, b: number, epsilon: number): boolean =>
  Math.abs(a - b) <= epsilon;
