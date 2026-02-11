import { Codex } from "@openai/codex-sdk";
import type { Thread } from "@openai/codex-sdk";

import { assertCodexCliAuthenticated } from "../codex-auth/codex-auth-guard.ts";
import {
  buildStoryBriefPromptInput,
  storyBriefOutputSchema,
} from "../../prompts/story-brief.prompt.ts";

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

export type GenerateStoryBriefRequest = {
  photos: Array<{ photoRef: string; path: string }>;
  conversation: unknown[];
  confirmedSummary: string;
  attempt: number;
  previousErrors: string[];
};

export interface StoryBriefAgentClient {
  generateStoryBrief(request: GenerateStoryBriefRequest): Promise<unknown>;
}

export type CreateCodexStoryBriefAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_STORY_BRIEF_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_STORY_BRIEF_CODEX_REASONING_EFFORT = "medium" as const;

export class StoryBriefAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryBriefAgentResponseParseError";
  }
}

export const createCodexStoryBriefAgentClient = ({
  model = DEFAULT_STORY_BRIEF_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_STORY_BRIEF_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory = () => new Codex(),
  assertAuthenticated = async () => assertCodexCliAuthenticated(),
}: CreateCodexStoryBriefAgentClientInput = {}): StoryBriefAgentClient => {
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
    async generateStoryBrief(request: GenerateStoryBriefRequest): Promise<unknown> {
      await assertAuthenticated();
      const turn = await getThread().run(buildStoryBriefPromptInput(request), {
        outputSchema: storyBriefOutputSchema,
      });
      return parseJsonFromFinalResponse(turn.finalResponse);
    },
  };
};

const parseJsonFromFinalResponse = (finalResponse: string): unknown => {
  const normalized = finalResponse.trim();
  const candidate =
    tryParseJson(normalized) ??
    tryParseJson(stripCodeFence(normalized));

  if (!candidate.ok) {
    throw new StoryBriefAgentResponseParseError(
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
