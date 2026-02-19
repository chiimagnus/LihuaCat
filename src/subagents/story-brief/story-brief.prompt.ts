import type { TabbyConversationEvent } from "../../contracts/tabby-conversation.types.ts";
import type { CodexPromptInput } from "../../tools/llm/llm.types.ts";

export type GenerateStoryBriefPromptRequest = {
  photos: Array<{ photoRef: string; path: string }>;
  conversation: TabbyConversationEvent[];
  confirmedSummary: string;
  attempt?: number;
  previousErrors: string[];
};

export const buildStoryBriefPromptInput = (
  request: GenerateStoryBriefPromptRequest,
): CodexPromptInput => {
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

