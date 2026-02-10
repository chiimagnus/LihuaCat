import { Codex } from "@openai/codex-sdk";
import type { Thread } from "@openai/codex-sdk";

import { assertCodexCliAuthenticated } from "./codex-auth-guard.ts";
import {
  buildStoryScriptPromptInput,
  storyScriptOutputSchema,
} from "../../prompts/index.ts";

export type GenerateStoryScriptRequest = {
  sourceDir: string;
  assets: Array<{
    id: string;
    path: string;
  }>;
  style: {
    preset: string;
    prompt?: string;
  };
  constraints: {
    durationSec: number;
    minDurationPerAssetSec: number;
    requireAllAssetsUsed: boolean;
  };
  attempt: number;
  previousErrors: string[];
};

export interface StoryAgentClient {
  generateStoryScript(request: GenerateStoryScriptRequest): Promise<unknown>;
}

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

export type CreateCodexStoryAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_CODEX_REASONING_EFFORT = "medium" as const;

export class StoryAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryAgentResponseParseError";
  }
}

export const createCodexStoryAgentClient = ({
  model = DEFAULT_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory = () => new Codex(),
  assertAuthenticated = async () => assertCodexCliAuthenticated(),
}: CreateCodexStoryAgentClientInput = {}): StoryAgentClient => {
  let thread: Pick<Thread, "run"> | undefined;

  const getThread = (): Pick<Thread, "run"> => {
    if (thread) {
      return thread;
    }
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
    async generateStoryScript(request: GenerateStoryScriptRequest): Promise<unknown> {
      await assertAuthenticated();
      const turn = await getThread().run(buildStoryScriptPromptInput(request), {
        outputSchema: storyScriptOutputSchema,
      });
      return parseStoryScriptFromResponse(turn.finalResponse);
    },
  };
};

const parseStoryScriptFromResponse = (finalResponse: string): unknown => {
  const normalized = finalResponse.trim();
  const candidate =
    tryParseJson(normalized) ??
    tryParseJson(stripCodeFence(normalized));

  if (!candidate.ok) {
    throw new StoryAgentResponseParseError(
      `Codex returned non-JSON response: ${truncateForError(normalized)}`,
    );
  }

  return candidate.value;
};

const stripCodeFence = (value: string): string => {
  if (!value.startsWith("```")) {
    return value;
  }
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
  if (value.length <= 240) {
    return value;
  }
  return `${value.slice(0, 240)}...`;
};
