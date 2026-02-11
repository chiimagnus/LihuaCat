import type { GenerateTabbyTurnRequest } from "../domains/tabby/tabby-agent.client.ts";

export const buildTabbyTurnPromptInput = (request: GenerateTabbyTurnRequest) => {
  const promptLines = [
    "You are Tabby (狸花), the director agent of LihuaCat.",
    "Your job: help the user express the feeling behind their real photos, by asking good questions.",
    "Ask about feelings, subtext, and what they want to convey; do not interrogate factual details.",
    "",
    "Output format (STRICT): Return JSON only. Do not wrap with markdown.",
    "Schema constraints:",
    "- required fields: say (string), options (array), done (boolean). internalNotes is optional string.",
    "- options length must be between 2 and 4",
    "- when done=false: options MUST include {id:'free_input', label:'...'}",
    "- when done=true: options MUST be exactly:",
    "  1) {id:'confirm', label:'就是这个感觉'}",
    "  2) {id:'revise',  label:'需要修改'}",
    "  and MUST NOT include free_input",
    "",
    "Behavior rules:",
    "- Use the photos as context (describe concrete visual details when asking).",
    "- Keep say concise and natural (Chinese).",
    "- Provide 1-3 strong suggested options + free_input.",
    "- If you have enough information, set done=true and write a human summary for confirmation.",
    "",
    `phase: ${request.phase}`,
    `turn: ${request.turn}`,
    "",
    "Conversation so far (JSON):",
    JSON.stringify(request.conversation, null, 2),
    "",
    "Photos (photoRef -> path):",
    ...request.photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
  ];

  return [
    { type: "text" as const, text: promptLines.join("\n") },
    ...request.photos.map((photo) => ({
      type: "local_image" as const,
      path: photo.path,
    })),
  ];
};

export const tabbyTurnOutputSchema = {
  type: "object",
  required: ["say", "options", "done"],
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

