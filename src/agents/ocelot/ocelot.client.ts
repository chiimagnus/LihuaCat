import { createCodexJsonRunner, type CodexLike, type ModelReasoningEffort, writeLlmDebugArtifacts } from "../../tools/llm/index.ts";
import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import { buildRenderScriptPromptInput } from "./ocelot.prompt.ts";
import { renderScriptOutputSchema } from "./ocelot.schema.ts";
import { validateRenderScriptSemantics, validateRenderScriptStructure } from "./ocelot.validate.ts";

export type GenerateRenderScriptRequest = {
  storyBriefRef: string;
  storyBrief: StoryBrief;
  photos: Array<{ photoRef: string; path: string }>;
  video: { width: number; height: number; fps: number };
  revisionNotes?: string[];
  debug?: {
    inputPath?: string;
    outputPath?: string;
    promptLogPath?: string;
  };
};

export interface OcelotAgentClient {
  generateRenderScript(request: GenerateRenderScriptRequest): Promise<RenderScript>;
}

export type CreateCodexOcelotAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_OCELOT_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_OCELOT_CODEX_REASONING_EFFORT = "medium" as const;

export class OcelotAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcelotAgentResponseParseError";
  }
}

export const createCodexOcelotAgentClient = ({
  model = DEFAULT_OCELOT_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_OCELOT_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory,
  assertAuthenticated = async () => {
    return;
  },
}: CreateCodexOcelotAgentClientInput = {}): OcelotAgentClient => {
  const runner = createCodexJsonRunner({
    model,
    modelReasoningEffort,
    workingDirectory,
    codexFactory,
  });

  return {
    async generateRenderScript(request: GenerateRenderScriptRequest): Promise<RenderScript> {
      await assertAuthenticated();

      const inputSnapshot = {
        storyBriefRef: request.storyBriefRef,
        storyBrief: request.storyBrief,
        revisionNotes: request.revisionNotes ?? [],
      };

      const promptInput = buildRenderScriptPromptInput(request);
      await writeLlmDebugArtifacts({
        debug: request.debug,
        promptInput,
        inputSnapshot,
      });

      let parsed: unknown;
      try {
        parsed = await runner.runJson(promptInput, {
          outputSchema: renderScriptOutputSchema,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new OcelotAgentResponseParseError(message);
      }

      const normalized = normalizeRenderScriptCandidate(parsed);
      const structure = validateRenderScriptStructure(normalized);
      if (!structure.valid || !structure.script) {
        await writeLlmDebugArtifacts({
          debug: request.debug,
          promptInput,
          outputSnapshot: normalized,
        });
        throw new OcelotAgentResponseParseError(
          `render-script structure invalid: ${structure.errors.join("; ")}`,
        );
      }

      const expectedPhotoRefs = request.photos.map((photo) => photo.photoRef);
      const semantic = validateRenderScriptSemantics(structure.script, {
        fixedVideo: request.video,
        expectedTotalDurationSec: 30,
        expectedPhotoRefs,
        requireAllPhotosUsed: true,
        allowedSlideDirections: ["left", "right"],
      });
      if (!semantic.valid) {
        await writeLlmDebugArtifacts({
          debug: request.debug,
          promptInput,
          outputSnapshot: structure.script,
        });
        throw new OcelotAgentResponseParseError(
          `render-script semantics invalid: ${semantic.errors.join("; ")}`,
        );
      }

      await writeLlmDebugArtifacts({
        debug: request.debug,
        promptInput,
        outputSnapshot: structure.script,
      });

      return structure.script;
    },
  };
};

const normalizeRenderScriptCandidate = (input: unknown): unknown => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return input;
  }
  const script = input as Record<string, unknown>;
  const scenes = script.scenes;
  if (!Array.isArray(scenes)) {
    return script;
  }

  for (const scene of scenes) {
    if (typeof scene !== "object" || scene === null || Array.isArray(scene)) {
      continue;
    }
    const sceneRecord = scene as Record<string, unknown>;

    if (sceneRecord.kenBurns === null) {
      delete sceneRecord.kenBurns;
    }

    const transition = sceneRecord.transition;
    if (typeof transition !== "object" || transition === null || Array.isArray(transition)) {
      continue;
    }
    const transitionRecord = transition as Record<string, unknown>;
    if (transitionRecord.type !== "slide" && "direction" in transitionRecord) {
      delete transitionRecord.direction;
    }
  }

  return script;
};

