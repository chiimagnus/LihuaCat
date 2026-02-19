import type { GenerateStoryBriefRequest } from "../domains/story-brief/story-brief-agent.client.ts";

export const buildStoryBriefPromptInput = (request: GenerateStoryBriefRequest) => {
  const promptLines = [
    "你正在为 LihuaCat（Tabby）生成一个 story-brief JSON。",
    "只返回 JSON，不要用 markdown 包裹。",
    "",
    "目标：根据多轮对话与真实照片，综合生成结构化的 StoryBrief。",
    "",
    "语言规则（非常重要）：",
    "- 所有“自然语言字段”（例如 coreEmotion/tone/narrativeArc/rawUserWords、photos[].userSaid/backstory/analysis、narrative.* 等）必须使用与用户相同的语言。",
    "- 如果无法判断用户语言：默认用中文；一旦对话中明显使用英文，后续全部切换为英文。",
    "- 仅对固定枚举值保持原样（例如 suggestedRole 只能是：开场/高潮/转折/收尾/过渡；duration 只能是：short/medium/long）。",
    "",
    "硬约束：",
    `- photos 数组长度必须等于 ${request.photos.length}`,
    "- emotionalWeight 必须在 0 到 1 之间",
    "- 每个 PhotoNote.photoRef 必须使用提供的 photoRef 值",
    "- suggestedRole 必须是以下之一：开场/高潮/转折/收尾/过渡",
    "- StoryBeat.duration 必须是以下之一：short/medium/long",
    "",
    "上下文：",
    `- confirmedSummary: ${request.confirmedSummary}`,
    "",
    "对话（JSON）：",
    JSON.stringify(request.conversation, null, 2),
    "",
    "照片（photoRef -> path）：",
    ...request.photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
  ];

  if (request.previousErrors.length > 0) {
    promptLines.push("");
    promptLines.push("需要修复的历史校验错误：");
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
