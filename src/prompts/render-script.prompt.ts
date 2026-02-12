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
    storyBriefRef: { type: "string" },
    video: {
      type: "object",
      required: ["width", "height", "fps"],
      additionalProperties: false,
      properties: {
        width: { type: "integer" },
        height: { type: "integer" },
        fps: { type: "integer" },
      },
    },
    scenes: {
      type: "array",
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
          sceneId: { type: "string" },
          photoRef: { type: "string" },
          subtitle: { type: "string" },
          subtitlePosition: { type: "string" },
          durationSec: { type: "number" },
          transition: {
            type: "object",
            required: ["type", "durationMs"],
            additionalProperties: true,
            properties: {
              type: { type: "string" },
              durationMs: { type: "number" },
              direction: { type: "string" },
            },
          },
          kenBurns: {
            type: "object",
            required: ["startScale", "endScale", "panDirection"],
            additionalProperties: false,
            properties: {
              startScale: { type: "number" },
              endScale: { type: "number" },
              panDirection: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;
