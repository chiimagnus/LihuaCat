import {
  createCodexJsonRunner,
  type CodexLike,
  type ModelReasoningEffort,
  writeLlmDebugArtifacts,
} from "../../tools/llm/index.ts";
import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import type { MidiComposition } from "../../contracts/midi.types.ts";
import { buildCubPromptInput } from "./cub.prompt.ts";
import { cubOutputSchema } from "./cub.schema.ts";
import { validateCubOutput } from "./cub.validate.ts";

export type GenerateCubMidiRequest = {
  creativePlanRef: string;
  creativePlan: CreativePlan;
  revisionNotes?: string[];
  debug?: {
    inputPath?: string;
    outputPath?: string;
    promptLogPath?: string;
  };
};

export interface CubAgentClient {
  generateMidiJson(request: GenerateCubMidiRequest): Promise<MidiComposition>;
}

export type CreateCodexCubAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_CUB_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_CUB_CODEX_REASONING_EFFORT = "medium" as const;

export class CubAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CubAgentResponseParseError";
  }
}

export const createCodexCubAgentClient = ({
  model = DEFAULT_CUB_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_CUB_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory,
  assertAuthenticated = async () => {
    return;
  },
}: CreateCodexCubAgentClientInput = {}): CubAgentClient => {
  const runner = createCodexJsonRunner({
    model,
    modelReasoningEffort,
    workingDirectory,
    codexFactory,
  });

  return {
    async generateMidiJson(request: GenerateCubMidiRequest): Promise<MidiComposition> {
      await assertAuthenticated();

      const inputSnapshot = {
        creativePlanRef: request.creativePlanRef,
        creativePlan: request.creativePlan,
        revisionNotes: request.revisionNotes ?? [],
      };
      const promptInput = buildCubPromptInput({
        creativePlan: request.creativePlan,
        revisionNotes: request.revisionNotes,
      });

      await writeLlmDebugArtifacts({
        debug: request.debug,
        promptInput,
        inputSnapshot,
      });

      let parsed: unknown;
      try {
        parsed = await runner.runJson(promptInput, {
          outputSchema: cubOutputSchema,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new CubAgentResponseParseError(message);
      }

      const validation = validateCubOutput(parsed, {
        creativePlan: request.creativePlan,
      });

      if (!validation.valid || !validation.midi) {
        await writeLlmDebugArtifacts({
          debug: request.debug,
          promptInput,
          outputSnapshot: parsed,
        });
        throw new CubAgentResponseParseError(
          `cub output invalid: ${validation.errors.join("; ")}`,
        );
      }

      await writeLlmDebugArtifacts({
        debug: request.debug,
        promptInput,
        outputSnapshot: validation.midi,
      });

      return validation.midi;
    },
  };
};

