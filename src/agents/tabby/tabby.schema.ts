export const tabbyTurnOutputSchema = {
  type: "object",
  required: ["say", "options", "done", "internalNotes"],
  additionalProperties: false,
  properties: {
    say: { type: "string", minLength: 1 },
    options: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        required: ["id", "label"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
        },
      },
    },
    done: { type: "boolean" },
    internalNotes: { type: "string", minLength: 1 },
  },
} as const;

