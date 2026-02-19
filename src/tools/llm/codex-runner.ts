import { Codex } from "@openai/codex-sdk";
import type { Thread } from "@openai/codex-sdk";

import type {
  CodexLike,
  CodexPromptInput,
  ModelReasoningEffort,
} from "./llm.types.ts";
import { parseJsonFromFinalResponse } from "./json.ts";

export type CreateCodexRunnerInput = {
  model: string;
  modelReasoningEffort: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
};

export type CodexJsonRunOptions = {
  outputSchema: unknown;
};

export type CodexJsonRunner = {
  runJson(promptInput: CodexPromptInput, options: CodexJsonRunOptions): Promise<unknown>;
};

export const createCodexJsonRunner = ({
  model,
  modelReasoningEffort,
  workingDirectory,
  codexFactory = () => new Codex(),
}: CreateCodexRunnerInput): CodexJsonRunner => {
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
    async runJson(promptInput: CodexPromptInput, options: CodexJsonRunOptions): Promise<unknown> {
      const turn = await getThread().run(promptInput, {
        outputSchema: options.outputSchema,
      });
      return parseJsonFromFinalResponse(turn.finalResponse);
    },
  };
};

