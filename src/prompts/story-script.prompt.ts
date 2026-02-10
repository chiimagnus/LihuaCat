import type { GenerateStoryScriptRequest } from "../domains/story-script/story-agent.client.ts";

export const buildStoryScriptPromptInput = (request: GenerateStoryScriptRequest) => {
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

export const storyScriptOutputSchema = {
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

