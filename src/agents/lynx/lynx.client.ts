import { createCodexJsonRunner, type CodexLike, type ModelReasoningEffort, writeLlmDebugArtifacts } from "../../tools/llm/index.ts";
import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { LynxReview } from "../../contracts/lynx-review.types.ts";
import { buildLynxReviewPromptInput } from "./lynx.prompt.ts";
import { lynxReviewOutputSchema } from "./lynx.schema.ts";
import { validateLynxReviewStructure } from "./lynx.validate.ts";

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
  codexFactory,
  assertAuthenticated = async () => {
    return;
  },
}: CreateCodexLynxAgentClientInput = {}): LynxAgentClient => {
  const runner = createCodexJsonRunner({
    model,
    modelReasoningEffort,
    workingDirectory,
    codexFactory,
  });

  return {
    async reviewRenderScript(request: GenerateLynxReviewRequest): Promise<LynxReview> {
      await assertAuthenticated();

      const promptInput = buildLynxReviewPromptInput({
        storyBrief: request.storyBrief,
        renderScript: request.renderScript,
        round: request.round,
        maxRounds: request.maxRounds,
      });

      await writeLlmDebugArtifacts({
        debug: request.debug,
        promptInput,
      });

      let parsed: unknown;
      try {
        parsed = await runner.runJson(promptInput, {
          outputSchema: lynxReviewOutputSchema,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new LynxAgentResponseParseError(message);
      }

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

