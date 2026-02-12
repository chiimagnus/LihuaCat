import type { GenerateStoryBriefRequest } from "../domains/story-brief/story-brief-agent.client.ts";

export const buildStoryBriefPromptInput = (request: GenerateStoryBriefRequest) => {
  const promptLines = [
    "You are generating a story-brief JSON for LihuaCat (Tabby).",
    "Return JSON only. Do not wrap with markdown.",
    "",
    "Goal: synthesize a structured StoryBrief from the multi-turn conversation and the real photos.",
    "",
    "Hard constraints:",
    `- photos array length must equal ${request.photos.length}`,
    "- emotionalWeight must be between 0 and 1",
    "- each PhotoNote.photoRef must use the provided photoRef values",
    "- suggestedRole must be one of: 开场/高潮/转折/收尾/过渡",
    "- StoryBeat.duration must be one of: short/medium/long",
    "",
    "Context:",
    `- confirmedSummary: ${request.confirmedSummary}`,
    "",
    "Conversation (JSON):",
    JSON.stringify(request.conversation, null, 2),
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
        audienceNote: {
          oneOf: [
            { type: "string", minLength: 1 },
            { type: "null" },
          ],
        },
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
