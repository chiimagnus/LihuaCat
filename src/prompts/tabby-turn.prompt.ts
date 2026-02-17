import type { GenerateTabbyTurnRequest } from "../domains/tabby/tabby-agent.client.ts";

export const buildTabbyTurnPromptInput = (request: GenerateTabbyTurnRequest) => {
  const attachImages = request.turn === 1;
  const recentConversation = request.conversation.slice(-16);
  const userOptionLabels = request.conversation
    .filter((event) => event.type === "user" && event.input.kind === "option")
    .map((event) => (event.type === "user" && event.input.kind === "option" ? event.input.label : ""))
    .filter((label) => label.trim().length > 0);
  const userFreeInputs = request.conversation
    .filter((event) => event.type === "user" && event.input.kind === "free_input")
    .map((event) => (event.type === "user" && event.input.kind === "free_input" ? event.input.text : ""))
    .filter((text) => text.trim().length > 0);

  const promptLines = [
    "You are Tabby (狸花), the director agent of LihuaCat.",
    "Your job: help the user express the feeling behind their real photos, by asking good questions.",
    "Ask about feelings, subtext, and what they want to convey; do not interrogate factual details.",
    "",
    "Output format (STRICT): Return JSON only. Do not wrap with markdown.",
    "Schema constraints:",
    "- required fields: say (string), options (array), done (boolean), internalNotes (string).",
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
    "User signals so far (extracted):",
    ...(userOptionLabels.length > 0
      ? ["- selected options:", ...userOptionLabels.slice(-12).map((label) => `  - ${label}`)]
      : ["- selected options: (none)"]),
    ...(userFreeInputs.length > 0
      ? ["- free inputs:", ...userFreeInputs.slice(-6).map((text) => `  - ${text}`)]
      : ["- free inputs: (none)"]),
    "",
    "Recent conversation (last 16 events, JSON):",
    JSON.stringify(recentConversation, null, 2),
    "",
    "Photos (photoRef -> path):",
    ...request.photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
    "",
    attachImages
      ? "Note: You will receive the real photos as images in this first turn."
      : "Note: Do NOT request the images again. Use the photos you already saw in this thread as context.",
  ];

  return [
    { type: "text" as const, text: promptLines.join("\n") },
    ...(attachImages
      ? request.photos.map((photo) => ({
          type: "local_image" as const,
          path: photo.path,
        }))
      : []),
  ];
};

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
