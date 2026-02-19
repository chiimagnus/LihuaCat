import type { CodexPromptInput } from "../../tools/llm/llm.types.ts";
import type { GenerateRenderScriptRequest } from "./ocelot.client.ts";

export const buildRenderScriptPromptInput = (
  request: GenerateRenderScriptRequest,
): CodexPromptInput => {
  const requiredPhotoRefs = request.photos.map((p) => p.photoRef);
  const promptLines = [
    "你是 Ocelot（虎猫），LihuaCat 的脚本编写 Agent。",
    "给定 StoryBrief（叙事资产）与真实照片，生成 render-script JSON（按 scene 组织），要忠实表达用户的感觉与意图。",
    "",
    "语言规则（非常重要）：",
    "- 所有自然语言输出（尤其是 scenes[].subtitle）必须使用与用户相同的语言（可从 StoryBrief 与对话中判断）。",
    "- 如果无法判断用户语言：默认用中文；一旦对话/StoryBrief 明显为英文，则输出英文字幕。",
    "",
    "输出格式（严格）：只返回 JSON，不要用 markdown 包裹。",
    "",
    "关键忠实性规则：",
    "- 你必须遵守 StoryBrief.intent.avoidance[]：不要出现被禁止的词/句式/氛围。",
    "- 如果提供了 revisionNotes，你必须逐条明确修复，并在新输出中体现。",
    "",
    "硬约束：",
    `- video.width 必须是 ${request.video.width}`,
    `- video.height 必须是 ${request.video.height}`,
    `- video.fps 必须是 ${request.video.fps}`,
    "- scenes 必须非空",
    "- 每个 scene.durationSec 必须 > 0",
    "- sum(scenes[].durationSec) 必须等于 30",
    "- 所有提供的 photoRef 都必须在 scenes 中至少使用一次",
    "- transition.type 必须是以下之一：cut|fade|dissolve|slide",
    "- 必须始终包含 transition.direction（left 或 right，P1 schema 约束）；非 slide 也要选一个最合适的方向",
    "- 每个 scene 都必须包含 kenBurns：不需要时用 null",
    "",
    "校验规则（任一失败都会被拒绝）：",
    "- 输出必须是符合 schema 的合法 JSON（无 markdown）。",
    "- scenes[].photoRef 必须至少覆盖所有 required photoRef 各一次。",
    "- 总时长必须精确为 30 秒。",
    "",
    "必需 photoRefs（必须全部至少出现一次于 scenes[].photoRef）：",
    ...requiredPhotoRefs.map((ref) => `- ${ref}`),
    "",
    ...(request.revisionNotes && request.revisionNotes.length > 0
      ? [
          "修订说明（必须全部修复）：",
          ...request.revisionNotes.map((note) => `- ${note}`),
          "",
        ]
      : []),
    "StoryBrief（JSON）：",
    JSON.stringify(request.storyBrief, null, 2),
    "",
    "照片（photoRef -> path）：",
    ...request.photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
  ];

  return [
    { type: "text" as const, text: promptLines.join("\n") },
    ...request.photos.map((photo) => ({ type: "local_image" as const, path: photo.path })),
  ];
};

