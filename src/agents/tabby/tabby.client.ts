import { createCodexJsonRunner, type CodexLike, type ModelReasoningEffort } from "../../tools/llm/index.ts";
import type { TabbyTurnOutput } from "../../contracts/tabby-turn.types.ts";
import type { TabbyConversationEvent } from "../../contracts/tabby-conversation.types.ts";
import { buildTabbyTurnPromptInput, type GenerateTabbyTurnRequest } from "./tabby.prompt.ts";
import { tabbyTurnOutputSchema } from "./tabby.schema.ts";
import { validateTabbyTurnOutput } from "./tabby.validate.ts";

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
  codexFactory,
  assertAuthenticated = async () => {
    return;
  },
}: CreateCodexTabbyAgentClientInput = {}): TabbyAgentClient => {
  const runner = createCodexJsonRunner({
    model,
    modelReasoningEffort,
    workingDirectory,
    codexFactory,
  });

  return {
    async generateTurn(request: GenerateTabbyTurnRequest): Promise<TabbyTurnOutput> {
      await assertAuthenticated();

      let parsed: unknown;
      try {
        parsed = await runner.runJson(buildTabbyTurnPromptInput(request), {
          outputSchema: tabbyTurnOutputSchema,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new TabbyAgentResponseParseError(message);
      }

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

export type { GenerateTabbyTurnRequest };
export type { TabbyConversationEvent };

