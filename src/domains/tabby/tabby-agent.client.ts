import { Codex } from "@openai/codex-sdk";
import type { Thread } from "@openai/codex-sdk";

import { assertCodexCliAuthenticated } from "../codex-auth/codex-auth-guard.ts";
import {
  buildTabbyTurnPromptInput,
  tabbyTurnOutputSchema,
} from "../../prompts/tabby-turn.prompt.ts";
import { validateTabbyTurnOutput } from "./validate-tabby-turn.ts";
import type { TabbyTurnOutput } from "../../contracts/tabby-turn.types.ts";

type ModelReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

type CodexLike = {
  startThread: (options?: {
    model?: string;
    modelReasoningEffort?: ModelReasoningEffort;
    workingDirectory?: string;
    skipGitRepoCheck?: boolean;
  }) => Pick<Thread, "run">;
};

export type GenerateTabbyTurnRequest = {
  photos: Array<{ photoRef: string; path: string }>;
  conversation: unknown[];
  phase: "start" | "chat" | "revise";
  turn: number;
};

export interface TabbyAgentClient {
  generateTurn(request: GenerateTabbyTurnRequest): Promise<TabbyTurnOutput>;
}

export type CreateCodexTabbyAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_TABBY_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_TABBY_CODEX_REASONING_EFFORT = "medium" as const;

export class TabbyAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TabbyAgentResponseParseError";
  }
}

export const createCodexTabbyAgentClient = ({
  model = DEFAULT_TABBY_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_TABBY_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory = () => new Codex(),
  assertAuthenticated = async () => assertCodexCliAuthenticated(),
}: CreateCodexTabbyAgentClientInput = {}): TabbyAgentClient => {
  let thread: Pick<Thread, "run"> | undefined;

  const getThread = (): Pick<Thread, "run"> => {
    if (thread) return thread;
    const codex = codexFactory();
    thread = codex.startThread({
      model,
      modelReasoningEffort,
      workingDirectory,
      skipGitRepoCheck: true,
    });
    return thread;
  };

  return {
    async generateTurn(request: GenerateTabbyTurnRequest): Promise<TabbyTurnOutput> {
      await assertAuthenticated();
      const turn = await getThread().run(buildTabbyTurnPromptInput(request), {
        outputSchema: tabbyTurnOutputSchema,
      });
      const parsed = parseJsonFromFinalResponse(turn.finalResponse);
      const validated = validateTabbyTurnOutput(parsed);
      if (!validated.valid || !validated.output) {
        throw new TabbyAgentResponseParseError(
          `Tabby output failed validation: ${validated.errors.join("; ")}`,
        );
      }
      return validated.output;
    },
  };
};

const parseJsonFromFinalResponse = (finalResponse: string): unknown => {
  const normalized = finalResponse.trim();
  const candidate =
    tryParseJson(normalized) ??
    tryParseJson(stripCodeFence(normalized));

  if (!candidate.ok) {
    throw new TabbyAgentResponseParseError(
      `Codex returned non-JSON response: ${truncateForError(normalized)}`,
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
