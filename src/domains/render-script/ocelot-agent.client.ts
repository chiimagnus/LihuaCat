import fs from "node:fs/promises";

import { Codex } from "@openai/codex-sdk";
import type { Thread } from "@openai/codex-sdk";

import { assertCodexCliAuthenticated } from "../story-script/codex-auth-guard.ts";
import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import {
  buildRenderScriptPromptInput,
  renderScriptOutputSchema,
} from "../../prompts/render-script.prompt.ts";
import {
  validateRenderScriptSemantics,
  validateRenderScriptStructure,
} from "./validate-render-script.ts";

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

export type GenerateRenderScriptRequest = {
  storyBriefRef: string;
  storyBrief: StoryBrief;
  photos: Array<{ photoRef: string; path: string }>;
  video: { width: number; height: number; fps: number };
  attempt: number;
  previousErrors: string[];
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
  codexFactory = () => new Codex(),
  assertAuthenticated = async () => assertCodexCliAuthenticated(),
}: CreateCodexOcelotAgentClientInput = {}): OcelotAgentClient => {
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
    async generateRenderScript(request: GenerateRenderScriptRequest): Promise<RenderScript> {
      await assertAuthenticated();

      if (request.debug?.inputPath) {
        await fs.writeFile(
          request.debug.inputPath,
          JSON.stringify({ storyBriefRef: request.storyBriefRef, storyBrief: request.storyBrief }, null, 2),
          "utf8",
        );
      }

      const promptInput = buildRenderScriptPromptInput(request);
      if (request.debug?.promptLogPath) {
        const textPart = promptInput.find((item) => item.type === "text");
        await fs.writeFile(
          request.debug.promptLogPath,
          typeof textPart?.text === "string" ? textPart.text : "",
          "utf8",
        );
      }

      const turn = await getThread().run(promptInput, {
        outputSchema: renderScriptOutputSchema,
      });

      const parsed = parseJsonFromFinalResponse(turn.finalResponse);
      const structure = validateRenderScriptStructure(parsed);
      if (!structure.valid || !structure.script) {
        throw new OcelotAgentResponseParseError(
          `render-script structure invalid: ${structure.errors.join("; ")}`,
        );
      }

      const expectedPhotoRefs = request.photos.map((photo) => photo.photoRef);
      const semantic = validateRenderScriptSemantics(structure.script, {
        fixedVideo: request.video,
        expectedPhotoRefs,
        requireAllPhotosUsed: true,
        allowedSlideDirections: ["left", "right"],
      });
      if (!semantic.valid) {
        throw new OcelotAgentResponseParseError(
          `render-script semantics invalid: ${semantic.errors.join("; ")}`,
        );
      }

      if (request.debug?.outputPath) {
        await fs.writeFile(
          request.debug.outputPath,
          JSON.stringify(structure.script, null, 2),
          "utf8",
        );
      }

      return structure.script;
    },
  };
};

const parseJsonFromFinalResponse = (finalResponse: string): unknown => {
  const normalized = finalResponse.trim();
  const candidate =
    tryParseJson(normalized) ??
    tryParseJson(stripCodeFence(normalized));

  if (!candidate.ok) {
    throw new OcelotAgentResponseParseError(
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

