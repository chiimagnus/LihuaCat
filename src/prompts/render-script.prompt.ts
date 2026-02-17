import type { GenerateRenderScriptRequest } from "../domains/render-script/ocelot-agent.client.ts";

export const buildRenderScriptPromptInput = (request: GenerateRenderScriptRequest) => {
  const requiredPhotoRefs = request.photos.map((p) => p.photoRef);
  const promptLines = [
    "You are Ocelot (虎猫), the scriptwriter agent of LihuaCat.",
    "Given a StoryBrief (narrative asset) and real photos, generate a render-script JSON (scene-based) that faithfully expresses the user's feeling.",
    "",
    "Output format (STRICT): Return JSON only. Do not wrap with markdown.",
    "",
    "Key fidelity rules:",
    "- You MUST obey StoryBrief.intent.avoidance[]. Do NOT use forbidden phrases or vibes.",
    "- If revisionNotes are provided, you MUST address every item explicitly in the new output.",
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
    "- ALWAYS include transition.direction as left or right (P1 schema constraint); for non-slide types, pick the best fit",
    "- kenBurns MUST be present on every scene: use null when you don't want ken burns",
    "",
    "Validation rules (your output will be rejected if any fails):",
    "- Return valid JSON matching the output schema (no markdown).",
    "- MUST use every required photoRef at least once in scenes[].photoRef.",
    "- MUST keep total duration exactly 30 seconds.",
    "",
    "Required photoRefs (MUST ALL appear in scenes[].photoRef at least once):",
    ...requiredPhotoRefs.map((ref) => `- ${ref}`),
    "",
    ...(request.revisionNotes && request.revisionNotes.length > 0
      ? [
          "Revision notes (MUST FIX ALL):",
          ...request.revisionNotes.map((note) => `- ${note}`),
          "",
        ]
      : []),
    "StoryBrief (JSON):",
    JSON.stringify(request.storyBrief, null, 2),
    "",
    "Photos (photoRef -> path):",
    ...request.photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
  ];

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
          "kenBurns",
        ],
        additionalProperties: false,
        properties: {
          sceneId: { type: "string", minLength: 1 },
          photoRef: { type: "string", minLength: 1 },
          subtitle: { type: "string", minLength: 1 },
          subtitlePosition: { type: "string", enum: ["bottom", "top", "center"] },
          durationSec: { type: "number", exclusiveMinimum: 0 },
          transition: {
            // Note: Codex outputSchema dialect does not permit oneOf/anyOf.
            // We enforce the discriminated union at runtime (validator).
            type: "object",
            required: ["type", "durationMs", "direction"],
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["cut", "fade", "dissolve", "slide"] },
              durationMs: { type: "number", minimum: 0 },
              direction: { type: "string", enum: ["left", "right"] },
            },
          },
          kenBurns: {
            type: ["object", "null"],
            required: ["startScale", "endScale", "panDirection"],
            additionalProperties: false,
            properties: {
              startScale: { type: "number", exclusiveMinimum: 0 },
              endScale: { type: "number", exclusiveMinimum: 0 },
              panDirection: {
                type: "string",
                enum: ["left", "right", "up", "down", "center"],
              },
            },
          },
        },
      },
    },
  },
} as const;
