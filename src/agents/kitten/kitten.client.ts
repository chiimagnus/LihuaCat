import {
  createCodexJsonRunner,
  type CodexLike,
  type ModelReasoningEffort,
  writeLlmDebugArtifacts,
} from "../../tools/llm/index.ts";
import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import type { VisualScript } from "../../contracts/visual-script.types.ts";
import { buildKittenPromptInput } from "./kitten.prompt.ts";
import { kittenOutputSchema } from "./kitten.schema.ts";
import { validateKittenOutput } from "./kitten.validate.ts";

export type GenerateKittenVisualScriptRequest = {
  creativePlanRef: string;
  creativePlan: CreativePlan;
  photos: Array<{ photoRef: string; path: string }>;
  revisionNotes?: string[];
  debug?: {
    inputPath?: string;
    outputPath?: string;
    promptLogPath?: string;
  };
};

export interface KittenAgentClient {
  generateVisualScript(request: GenerateKittenVisualScriptRequest): Promise<VisualScript>;
}

export type CreateCodexKittenAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_KITTEN_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_KITTEN_CODEX_REASONING_EFFORT = "medium" as const;

export class KittenAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KittenAgentResponseParseError";
  }
}

export const createCodexKittenAgentClient = ({
  model = DEFAULT_KITTEN_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_KITTEN_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory,
  assertAuthenticated = async () => {
    return;
  },
}: CreateCodexKittenAgentClientInput = {}): KittenAgentClient => {
  const runner = createCodexJsonRunner({
    model,
    modelReasoningEffort,
    workingDirectory,
    codexFactory,
  });

  return {
    async generateVisualScript(request: GenerateKittenVisualScriptRequest): Promise<VisualScript> {
      await assertAuthenticated();

      const inputSnapshot = {
        creativePlanRef: request.creativePlanRef,
        creativePlan: request.creativePlan,
        revisionNotes: request.revisionNotes ?? [],
      };
      const promptInput = buildKittenPromptInput({
        creativePlan: request.creativePlan,
        photos: request.photos,
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
          outputSchema: kittenOutputSchema,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new KittenAgentResponseParseError(message);
      }

      const validation = validateKittenOutput(parsed, {
        creativePlan: request.creativePlan,
        expectedPhotoRefs: request.photos.map((photo) => photo.photoRef),
      });

      if (!validation.valid || !validation.script) {
        await writeLlmDebugArtifacts({
          debug: request.debug,
          promptInput,
          outputSnapshot: parsed,
        });
        throw new KittenAgentResponseParseError(
          `kitten output invalid: ${validation.errors.join("; ")}`,
        );
      }

      await writeLlmDebugArtifacts({
        debug: request.debug,
        promptInput,
        outputSnapshot: validation.script,
      });

      return validation.script;
    },
  };
};

