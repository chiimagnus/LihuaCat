import type {
  TabbyTurnOutput,
  TabbyTurnValidationResult,
} from "../../contracts/tabby-turn.types.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const validateTabbyTurnOutput = (
  input: unknown,
): TabbyTurnValidationResult & { output?: TabbyTurnOutput } => {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["tabby-turn must be an object"] };
  }

  if (!isNonEmptyString(input.say)) {
    errors.push("say is required");
  }

  if (typeof input.done !== "boolean") {
    errors.push("done must be boolean");
  }

  if (!Array.isArray(input.options)) {
    errors.push("options is required");
  } else {
    if (input.options.length < 2 || input.options.length > 4) {
      errors.push("options length must be between 2 and 4");
    }
    input.options.forEach((option, index) => {
      if (!isRecord(option)) {
        errors.push(`options[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(option.id)) errors.push(`options[${index}].id is required`);
      if (!isNonEmptyString(option.label)) errors.push(`options[${index}].label is required`);
    });

    const done = input.done === true;
    if (!done) {
      const hasFreeInput = input.options.some(
        (option) => isRecord(option) && option.id === "free_input",
      );
      if (!hasFreeInput) {
        errors.push('options must include id "free_input" when done=false');
      }
    } else {
      const normalized = input.options
        .filter((option): option is { id: string; label: string } => isRecord(option))
        .map((option) => ({ id: String(option.id), label: String(option.label) }));

      if (normalized.length !== 2) {
        errors.push("options must be exactly 2 items when done=true");
      } else {
        const ids = new Set(normalized.map((option) => option.id));
        if (!(ids.has("confirm") && ids.has("revise") && ids.size === 2)) {
          errors.push('options must contain exactly ids "confirm" and "revise" when done=true');
        }
      }

      const hasFreeInput = normalized.some((option) => option.id === "free_input");
      if (hasFreeInput) {
        errors.push('options must not include id "free_input" when done=true');
      }
    }
  }

  if (!isNonEmptyString(input.internalNotes)) {
    errors.push("internalNotes is required");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], output: input as TabbyTurnOutput };
};

