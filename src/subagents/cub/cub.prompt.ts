import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import type { CodexPromptInput } from "../../tools/llm/llm.types.ts";

export const buildCubPromptInput = ({
  creativePlan,
  revisionNotes,
}: {
  creativePlan: CreativePlan;
  revisionNotes?: string[];
}): CodexPromptInput => {
  const promptLines = [
    "你是 Cub（幼崽），LihuaCat 的音乐 sub-agent。",
    "给定 CreativePlan 的音乐意图，输出严格符合 MIDI JSON Schema 的结构化结果。",
    "",
    "语言规则（非常重要）：",
    "- 所有自然语言字段（例如 keyMoments[].label）必须与用户语言一致。",
    "- 如果无法判断用户语言：默认中文；明显为英文则输出英文。",
    "",
    "输出格式（严格）：只返回 JSON，不要用 markdown 包裹。",
    "",
    "硬约束：",
    "- timeSignature 必须是 4/4。",
    "- tracks 必须且仅有 4 条：Piano/Strings/Bass/Drums。",
    "- 轨道配置固定：Piano(channel=0,program=0)、Strings(channel=1,program=48)、Bass(channel=2,program=33)、Drums(channel=9,program=0)。",
    "- notes 必须使用 startMs + durationMs，且 startMs 非递减、durationMs > 0。",
    "- 所有 notes 结束时间不能超过 durationMs。",
    "",
    "风格约束：",
    "- 必须忠实执行 CreativePlan.musicIntent（moodKeywords、bpmTrend、keyMoments、instrumentationHints、durationMs）。",
    "- 若提供了 revisionNotes，必须逐条修复并反映在输出中。",
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
  ];

  return [{ type: "text" as const, text: promptLines.join("\n") }];
};

