export const storyBriefOutputSchema = {
  type: "object",
  required: ["intent", "photos", "narrative"],
  additionalProperties: false,
  properties: {
    intent: {
      type: "object",
      required: [
        "coreEmotion",
        "tone",
        "narrativeArc",
        "audienceNote",
        "avoidance",
        "rawUserWords",
      ],
      additionalProperties: false,
      properties: {
        coreEmotion: { type: "string", minLength: 1 },
        tone: { type: "string", minLength: 1 },
        narrativeArc: { type: "string", minLength: 1 },
        // Note: Codex outputSchema dialect does not permit oneOf/anyOf.
        // We keep this as a simple nullable string and rely on the
        // runtime validator to enforce non-empty strings when present.
        audienceNote: { type: ["string", "null"] },
        avoidance: {
          type: "array",
          items: { type: "string", minLength: 1 },
        },
        rawUserWords: { type: "string", minLength: 1 },
      },
    },
    photos: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: [
          "photoRef",
          "userSaid",
          "emotionalWeight",
          "suggestedRole",
          "backstory",
          "analysis",
        ],
        additionalProperties: false,
        properties: {
          photoRef: { type: "string", minLength: 1 },
          userSaid: { type: "string" },
          emotionalWeight: { type: "number", minimum: 0, maximum: 1 },
          suggestedRole: {
            type: "string",
            enum: ["开场", "高潮", "转折", "收尾", "过渡"],
          },
          backstory: { type: "string" },
          analysis: { type: "string", minLength: 1 },
        },
      },
    },
    narrative: {
      type: "object",
      required: ["arc", "beats"],
      additionalProperties: false,
      properties: {
        arc: { type: "string", minLength: 1 },
        beats: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["photoRefs", "moment", "emotion", "duration", "transition"],
            additionalProperties: false,
            properties: {
              photoRefs: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 },
              },
              moment: { type: "string", minLength: 1 },
              emotion: { type: "string", minLength: 1 },
              duration: { type: "string", enum: ["short", "medium", "long"] },
              transition: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
  },
} as const;

