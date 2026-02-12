import type { GenerateRenderScriptRequest } from "../domains/render-script/ocelot-agent.client.ts";

export const buildRenderScriptPromptInput = (request: GenerateRenderScriptRequest) => {
  const promptLines = [
    "You are Ocelot (虎猫), the scriptwriter agent of LihuaCat.",
    "Given a StoryBrief (narrative asset) and real photos, generate a render-script JSON (scene-based) that faithfully expresses the user's feeling.",
    "",
    "Output format (STRICT): Return JSON only. Do not wrap with markdown.",
    "",
    "Hard constraints:",
    `- video.width must be ${request.video.width}`,
    `- video.height must be ${request.video.height}`,
    `- video.fps must be ${request.video.fps}`,
    "- scenes must be non-empty",
    "- each scene.durationSec must be > 0",
    "- sum(scenes[].durationSec) must be 30",
    "- every provided photoRef must be used at least once in scenes",
    "- transition.type must be one of: cut|fade|dissolve|slide",
    "- if transition.type is slide, direction must be left or right (P1 constraint)",
    "- kenBurns is optional; when present, use subtle, safe values if unsure",
    "",
    "StoryBrief (JSON):",
    JSON.stringify(request.storyBrief, null, 2),
    "",
    "Photos (photoRef -> path):",
    ...request.photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
  ];

  if (request.previousErrors.length > 0) {
    promptLines.push("");
    promptLines.push("Previous validation errors to fix:");
    promptLines.push(...request.previousErrors.map((error) => `- ${error}`));
  }

  return [
    { type: "text" as const, text: promptLines.join("\n") },
    ...request.photos.map((photo) => ({ type: "local_image" as const, path: photo.path })),
  ];
};

export const renderScriptOutputSchema = {
  type: "object",
  required: ["storyBriefRef", "video", "scenes"],
  additionalProperties: false,
  properties: {
    storyBriefRef: { type: "string", minLength: 1 },
    video: {
      type: "object",
      required: ["width", "height", "fps"],
      additionalProperties: false,
      properties: {
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
        fps: { type: "integer", minimum: 1 },
      },
    },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: [
          "sceneId",
          "photoRef",
          "subtitle",
          "subtitlePosition",
          "durationSec",
          "transition",
        ],
        additionalProperties: false,
        properties: {
          sceneId: { type: "string", minLength: 1 },
          photoRef: { type: "string", minLength: 1 },
          subtitle: { type: "string", minLength: 1 },
          subtitlePosition: { type: "string", enum: ["bottom", "top", "center"] },
          durationSec: { type: "number", exclusiveMinimum: 0 },
          transition: {
            oneOf: [
              {
                type: "object",
                required: ["type", "durationMs"],
                additionalProperties: false,
                properties: {
                  type: { const: "cut" },
                  durationMs: { type: "number", minimum: 0 },
                },
              },
              {
                type: "object",
                required: ["type", "durationMs"],
                additionalProperties: false,
                properties: {
                  type: { const: "fade" },
                  durationMs: { type: "number", minimum: 0 },
                },
              },
              {
                type: "object",
                required: ["type", "durationMs"],
                additionalProperties: false,
                properties: {
                  type: { const: "dissolve" },
                  durationMs: { type: "number", minimum: 0 },
                },
              },
              {
                type: "object",
                required: ["type", "durationMs", "direction"],
                additionalProperties: false,
                properties: {
                  type: { const: "slide" },
                  durationMs: { type: "number", minimum: 0 },
                  direction: { type: "string", enum: ["left", "right"] },
                },
              },
            ],
          },
          kenBurns: {
            type: "object",
            required: ["startScale", "endScale", "panDirection"],
            additionalProperties: false,
            properties: {
              startScale: { type: "number", exclusiveMinimum: 0 },
              endScale: { type: "number", exclusiveMinimum: 0 },
              panDirection: { type: "string", enum: ["left", "right", "up", "down", "center"] },
            },
          },
        },
      },
    },
  },
} as const;
