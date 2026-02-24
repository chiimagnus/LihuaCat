import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import type { CodexPromptInput } from "../../tools/llm/llm.types.ts";

export const buildKittenPromptInput = ({
  creativePlan,
  photos,
  revisionNotes,
}: {
  creativePlan: CreativePlan;
  photos: Array<{ photoRef: string; path: string }>;
  revisionNotes?: string[];
}): CodexPromptInput => {
  const targetDurationSec = creativePlan.musicIntent.durationMs / 1000;
  const promptLines = [
    "你是 Kitten（幼猫），LihuaCat 的视觉脚本 sub-agent。",
    "给定 CreativePlan 的视觉方向与图片，输出严格符合 VisualScript schema 的 JSON。",
    "",
    "语言规则（非常重要）：",
    "- scenes[].subtitle 的语言必须与用户语言一致。",
    "- 如果无法判断用户语言：默认中文；明显为英文则输出英文。",
    "",
    "输出格式（严格）：只返回 JSON，不要用 markdown 包裹。",
    "",
    "硬约束：",
    "- creativePlanRef 必须由输入给定。",
    "- video.width 必须是 1080。",
    "- video.height 必须是 1920。",
    "- video.fps 必须是 30。",
    "- scenes 必须非空，且 durationSec > 0。",
    `- sum(scenes[].durationSec) 必须精确等于 ${targetDurationSec} 秒（来自 CreativePlan.musicIntent.durationMs）。`,
    "- 所有提供的 photoRef 都必须在 scenes[].photoRef 中至少出现一次。",
    "- transition.type 必须是 cut|fade|dissolve|slide。",
    "- 若 transition.type 是 slide，必须提供合法 direction。",
    "",
    "质量约束：",
    "- 忠实执行 CreativePlan.visualDirection。",
    "- 分镜节奏需与 CreativePlan.narrativeArc 保持一致。",
    "- 优先确保字幕短句、自然、不过度抒情。",
    "- subtitle 必须是面向观众的叙事句子，不要写时间轴（如 10-25秒）或音乐制作术语（如 MIDI/BPM/音轨/乐器编制）。",
    "",
    ...(revisionNotes && revisionNotes.length > 0
      ? [
          "修订说明（必须全部修复）：",
          ...revisionNotes.map((note) => `- ${note}`),
          "",
        ]
      : []),
    "CreativePlan（JSON）：",
    JSON.stringify(creativePlan, null, 2),
    "",
    "必需 photoRefs（必须全部至少出现一次）：",
    ...photos.map((photo) => `- ${photo.photoRef}`),
    "",
    "照片（photoRef -> path）：",
    ...photos.map((photo) => `- ${photo.photoRef}: ${photo.path}`),
  ];

  return [
    { type: "text" as const, text: promptLines.join("\n") },
    ...photos.map((photo) => ({ type: "local_image" as const, path: photo.path })),
  ];
};
