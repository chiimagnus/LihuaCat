import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import {
  validateVisualScript,
  type VisualScript,
  type VisualScriptValidationResult,
} from "../../contracts/visual-script.types.ts";

export type KittenValidationResult = VisualScriptValidationResult & { script?: VisualScript };

export const validateKittenOutput = (
  input: unknown,
  context: {
    creativePlan?: CreativePlan;
    expectedPhotoRefs?: string[];
    expectedTotalDurationSec?: number;
    durationToleranceSec?: number;
  } = {},
): KittenValidationResult => {
  const structure = validateVisualScript(input);
  if (!structure.valid || !structure.script) {
    return structure;
  }

  const errors: string[] = [];

  if (context.creativePlan && structure.script.creativePlanRef.length === 0) {
    errors.push("creativePlanRef is required");
  }

  if (context.expectedPhotoRefs && context.expectedPhotoRefs.length > 0) {
    const used = new Set(structure.script.scenes.map((scene) => scene.photoRef));
    for (const photoRef of context.expectedPhotoRefs) {
      if (!used.has(photoRef)) {
        errors.push(`photoRef ${photoRef} is not used in scenes`);
      }
    }
  }

  if (typeof context.expectedTotalDurationSec === "number") {
    const totalDurationSec = structure.script.scenes.reduce(
      (sum, scene) => sum + scene.durationSec,
      0,
    );
    const tolerance = context.durationToleranceSec ?? 1e-6;
    if (Math.abs(totalDurationSec - context.expectedTotalDurationSec) > tolerance) {
      errors.push(
        `total visual duration must equal ${context.expectedTotalDurationSec}s`,
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], script: structure.script };
};
