export const lynxReviewOutputSchema = {
  type: "object",
  required: ["passed", "summary", "issues", "requiredChanges"],
  additionalProperties: false,
  properties: {
    passed: { type: "boolean" },
    summary: { type: "string", minLength: 1 },
    issues: {
      type: "array",
      items: {
        type: "object",
        required: ["category", "message"],
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: [
              "avoidance_conflict",
              "tone_mismatch",
              "audience_mismatch",
              "narrative_arc_mismatch",
              "other",
            ],
          },
          message: { type: "string", minLength: 1 },
        },
      },
    },
    requiredChanges: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
} as const;

