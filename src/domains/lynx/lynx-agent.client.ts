import fs from "node:fs/promises";

import { Codex } from "@openai/codex-sdk";
import type { Thread } from "@openai/codex-sdk";

import { assertCodexCliAuthenticated } from "../codex-auth/codex-auth-guard.ts";
import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { LynxReview } from "../../contracts/lynx-review.types.ts";
import {
  buildLynxReviewPromptInput,
  lynxReviewOutputSchema,
} from "../../prompts/lynx-review.prompt.ts";
import { validateLynxReviewStructure } from "./validate-lynx-review.ts";

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

export type GenerateLynxReviewRequest = {
  storyBriefRef?: string;
  storyBrief: StoryBrief;
  renderScriptRef?: string;
  renderScript: RenderScript;
  round: number;
  maxRounds: number;
  debug?: {
    promptLogPath?: string;
  };
};

export interface LynxAgentClient {
  reviewRenderScript(request: GenerateLynxReviewRequest): Promise<LynxReview>;
}

export type CreateCodexLynxAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_LYNX_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_LYNX_CODEX_REASONING_EFFORT = "medium" as const;

export class LynxAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LynxAgentResponseParseError";
  }
}

export const createCodexLynxAgentClient = ({
  model = DEFAULT_LYNX_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_LYNX_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory = () => new Codex(),
  assertAuthenticated = async () => assertCodexCliAuthenticated(),
}: CreateCodexLynxAgentClientInput = {}): LynxAgentClient => {
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
    async reviewRenderScript(request: GenerateLynxReviewRequest): Promise<LynxReview> {
      await assertAuthenticated();

      const promptInput = buildLynxReviewPromptInput({
        storyBrief: request.storyBrief,
        renderScript: request.renderScript,
        round: request.round,
        maxRounds: request.maxRounds,
      });

      if (request.debug?.promptLogPath) {
        const textPart = promptInput.find((item) => item.type === "text");
        await fs.writeFile(
          request.debug.promptLogPath,
          typeof textPart?.text === "string" ? textPart.text : "",
          "utf8",
        );
      }

      const turn = await getThread().run(promptInput, {
        outputSchema: lynxReviewOutputSchema,
      });

      const parsed = parseJsonFromFinalResponse(turn.finalResponse);
      const structure = validateLynxReviewStructure(parsed);
      if (!structure.valid || !structure.review) {
        throw new LynxAgentResponseParseError(
          `lynx review structure invalid: ${structure.errors.join("; ")}`,
        );
      }

      return structure.review;
    },
  };
};

const parseJsonFromFinalResponse = (finalResponse: string): unknown => {
  const normalized = finalResponse.trim();
  const candidate =
    tryParseJson(normalized) ??
    tryParseJson(stripCodeFence(normalized));

  if (!candidate.ok) {
    throw new LynxAgentResponseParseError(
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

