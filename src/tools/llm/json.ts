export class LlmJsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmJsonParseError";
  }
}

export const parseJsonFromFinalResponse = (finalResponse: string): unknown => {
  const normalized = finalResponse.trim();
  const candidate =
    tryParseJson(normalized) ?? tryParseJson(stripCodeFence(normalized));

  if (!candidate.ok) {
    throw new LlmJsonParseError(
      `LLM returned non-JSON response: ${truncateForError(normalized)}`,
    );
  }

  return candidate.value;
};

const stripCodeFence = (value: string): string => {
  if (!value.startsWith("```")) return value;
  return value
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
};

const tryParseJson = (
  value: string,
): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
};

const truncateForError = (value: string): string => {
  if (value.length <= 240) return value;
  return `${value.slice(0, 240)}...`;
};

