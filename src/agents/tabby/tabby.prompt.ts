import type { TabbyConversationEvent } from "../../contracts/tabby-conversation.types.ts";
import type { CodexPromptInput } from "../../tools/llm/llm.types.ts";

export type GenerateTabbyTurnRequest = {
  photos: Array<{ photoRef: string; path: string }>;
  conversation: TabbyConversationEvent[];
  phase: "start" | "chat" | "revise";
  turn: number;
};

export const buildTabbyTurnPromptInput = (
  request: GenerateTabbyTurnRequest,
): CodexPromptInput => {
  const attachImages = request.turn === 1;
  const recentConversation = request.conversation.slice(-16);
  const userOptionLabels = request.conversation
    .filter((event) => event.type === "user" && event.input.kind === "option")
    .map((event) =>
      event.type === "user" && event.input.kind === "option" ? event.input.label : "",
    )
    .filter((label) => label.trim().length > 0);
  const userFreeInputs = request.conversation
    .filter((event) => event.type === "user" && event.input.kind === "free_input")
    .map((event) =>
      event.type === "user" && event.input.kind === "free_input" ? event.input.text : "",
    )
    .filter((text) => text.trim().length > 0);

  const promptLines = [
    "你是 Tabby（狸花），LihuaCat 的导演型 Agent。",
    "你的工作：通过提出好问题，帮助用户说清楚“真实照片背后的感觉”。",
    "你要问感受、潜台词、想传达的东西；不要像审讯一样追问事实细节。",
    "",
    "语言规则（非常重要）：",
    "- 始终使用与用户相同的语言来写所有自然语言输出。",
    "- 如果无法判断用户语言：默认用中文；一旦用户在对话中明显使用英文（完整英文句子/英文占主导），后续全部切换为英文。",
    "",
    "输出格式（严格）：只返回 JSON，不要用 markdown 包裹。",
    "Schema 约束：",
    "- 必填字段：say（string）、options（array）、done（boolean）、internalNotes（string）。",
    "- options 长度必须在 2 到 4 之间。",
    "- 当 done=false：options 必须包含 {id:'free_input', label:'...'}（label 用用户语言）。",
    "- 当 done=true：options 必须且只能包含 2 个选项，并且按顺序为：",
    "  1) {id:'confirm', label:'...'}（label 用用户语言，例如中文“就是这个感觉”、英文“That's it”）",
    "  2) {id:'revise',  label:'...'}（label 用用户语言，例如中文“需要修改”、英文“Needs changes”）",
    "  且不得包含 free_input。",
    "",
    "行为规则：",
    "- 把照片当作上下文：提问时要引用具体视觉细节（人物/动作/光线/场景/氛围）。",
    "- say 要简洁、自然、像人说话（并遵守上面的语言规则）。",
    "- 提供 1–3 个高质量建议选项 + free_input。",
    "- 信息足够时设置 done=true，并在 say 中写出一段可让用户确认的“人话总结”。",
    "",
    `phase: ${request.phase}`,
    `turn: ${request.turn}`,
    "",
    "用户信号（提取）：",
    ...(userOptionLabels.length > 0
      ? ["- 已选择选项：", ...userOptionLabels.slice(-12).map((label) => `  - ${label}`)]
      : ["- 已选择选项：(无)"]),
    ...(userFreeInputs.length > 0
      ? ["- 自由输入：", ...userFreeInputs.slice(-6).map((text) => `  - ${text}`)]
      : ["- 自由输入：(无)"]),
    "",
    "最近对话（最后 16 条事件，JSON）：",
    JSON.stringify(recentConversation, null, 2),
    "",
    "照片（photoRef -> path）：",
    ...request.photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
    "",
    attachImages
      ? "备注：这是第一轮，你会以图片形式收到真实照片。"
      : "备注：不要再次请求图片。使用你在本线程里已经看到的照片作为上下文。",
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

