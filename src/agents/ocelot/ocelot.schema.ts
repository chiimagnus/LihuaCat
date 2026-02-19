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

