import { Codex } from "@openai/codex-sdk";
import type { Thread } from "@openai/codex-sdk";

import { assertCodexCliAuthenticated } from "./codex-auth-guard.ts";

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
      const turn = await getThread().run(buildPromptInput(request), {
        outputSchema: storyScriptOutputSchema,
      });
      return parseStoryScriptFromResponse(turn.finalResponse);
    },
  };
};

const buildPromptInput = (request: GenerateStoryScriptRequest) => {
  const promptLines = [
    "You are generating a story-script JSON for LihuaCat.",
    "Return JSON only. Do not wrap with markdown.",
    "Always include style.prompt as a string field (empty string is allowed).",
    "Always include validation with fields: allAssetsUsedAtLeastOnce, minDurationPerAssetSec, durationTotalSec.",
    "",
    "Hard constraints:",
    `- durationSec must equal ${request.constraints.durationSec}`,
    `- each timeline segment duration must be >= ${request.constraints.minDurationPerAssetSec} sec`,
    `- all assets must be used at least once: ${request.constraints.requireAllAssetsUsed}`,
    "- timeline must start from 0 and be contiguous with no overlaps or gaps",
    "",
    `style preset: ${request.style.preset}`,
    `style prompt: ${request.style.prompt ?? ""}`,
    "",
    "Assets (use these asset IDs exactly):",
    ...request.assets.map((asset) => `- ${asset.id}: ${asset.path}`),
  ];

  if (request.previousErrors.length > 0) {
    promptLines.push("");
    promptLines.push("Previous validation errors to fix:");
    promptLines.push(...request.previousErrors.map((error) => `- ${error}`));
  }

  return [
    {
      type: "text" as const,
      text: promptLines.join("\n"),
    },
    ...request.assets.map((asset) => ({
      type: "local_image" as const,
      path: asset.path,
    })),
  ];
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

const storyScriptOutputSchema = {
  type: "object",
  required: ["version", "input", "video", "style", "timeline", "subtitles", "validation"],
  additionalProperties: false,
  properties: {
    version: { type: "string" },
    input: {
      type: "object",
      required: ["sourceDir", "imageCount", "assets"],
      additionalProperties: false,
      properties: {
        sourceDir: { type: "string" },
        imageCount: { type: "integer", minimum: 1 },
        assets: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["id", "path"],
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              path: { type: "string" },
            },
          },
        },
      },
    },
    video: {
      type: "object",
      required: ["width", "height", "fps", "durationSec"],
      additionalProperties: false,
      properties: {
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
        fps: { type: "integer", minimum: 1 },
        durationSec: { type: "number", minimum: 1 },
      },
    },
    style: {
      type: "object",
      required: ["preset", "prompt"],
      additionalProperties: false,
      properties: {
        preset: { type: "string" },
        prompt: { type: "string" },
      },
    },
    timeline: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["assetId", "startSec", "endSec", "subtitleId"],
        additionalProperties: false,
        properties: {
          assetId: { type: "string" },
          startSec: { type: "number", minimum: 0 },
          endSec: { type: "number", exclusiveMinimum: 0 },
          subtitleId: { type: "string" },
        },
      },
    },
    subtitles: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "text", "startSec", "endSec"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          startSec: { type: "number", minimum: 0 },
          endSec: { type: "number", exclusiveMinimum: 0 },
        },
      },
    },
    validation: {
      type: "object",
      required: [
        "allAssetsUsedAtLeastOnce",
        "minDurationPerAssetSec",
        "durationTotalSec",
      ],
      additionalProperties: false,
      properties: {
        allAssetsUsedAtLeastOnce: { type: "boolean" },
        minDurationPerAssetSec: { type: "number", minimum: 0 },
        durationTotalSec: { type: "number", minimum: 0 },
      },
    },
  },
} as const;
