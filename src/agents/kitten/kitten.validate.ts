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

  const expectedDurationMs = context.creativePlan?.musicIntent.durationMs;
  if (
    typeof expectedDurationMs === "number" &&
    Number.isInteger(expectedDurationMs) &&
    expectedDurationMs > 0
  ) {
    const totalDurationMs = Math.round(
      structure.script.scenes.reduce((sum, scene) => sum + scene.durationSec, 0) * 1000,
    );
    if (totalDurationMs !== expectedDurationMs) {
      errors.push(
        `total visual duration must equal creativePlan.musicIntent.durationMs (${expectedDurationMs}ms)`,
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], script: structure.script };
};

