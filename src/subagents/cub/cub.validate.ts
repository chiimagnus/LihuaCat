import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import {
  validateMidiComposition,
  type MidiComposition,
  type MidiValidationResult,
} from "../../contracts/midi.types.ts";

export type CubValidationResult = MidiValidationResult & { midi?: MidiComposition };

export const validateCubOutput = (
  input: unknown,
  context: {
    creativePlan?: CreativePlan;
  } = {},
): CubValidationResult => {
  const structure = validateMidiComposition(input);
  if (!structure.valid || !structure.midi) {
    return structure;
  }

  const errors: string[] = [];
  const expectedDurationMs = context.creativePlan?.musicIntent.durationMs;
  if (
    typeof expectedDurationMs === "number" &&
    Number.isInteger(expectedDurationMs) &&
    expectedDurationMs > 0 &&
    structure.midi.durationMs !== expectedDurationMs
  ) {
    errors.push(
      `durationMs must match creativePlan.musicIntent.durationMs (${expectedDurationMs})`,
    );
  }

  const keyMoments = context.creativePlan?.musicIntent.keyMoments ?? [];
  if (keyMoments.length > 0) {
    const hasNotes = structure.midi.tracks.some((track) => track.notes.length > 0);
    if (!hasNotes) {
      errors.push("at least one note is required when creativePlan contains keyMoments");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], midi: structure.midi };
};

