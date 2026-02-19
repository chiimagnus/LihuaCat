import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { CodexPromptInput } from "../../tools/llm/llm.types.ts";

export type BuildLynxReviewPromptInputRequest = {
  storyBrief: StoryBrief;
  renderScript: RenderScript;
  round: number;
  maxRounds: number;
};

export const buildLynxReviewPromptInput = ({
  storyBrief,
  renderScript,
  round,
  maxRounds,
}: BuildLynxReviewPromptInputRequest): CodexPromptInput => {
  const promptLines = [
    "你是 Lynx（猞猁），LihuaCat 的审稿 Agent。",
    "你将评审 RenderScript 是否忠实表达了 StoryBrief 的叙事意图。",
    "",
    "语言规则（非常重要）：",
    "- summary、issues[].message、requiredChanges 的自然语言必须与用户语言一致（可从 StoryBrief 与字幕语言判断）。",
    "- 如果无法判断用户语言：默认中文；明显为英文则输出英文。",
    "",
    "输出格式（严格）：只返回 JSON，不要用 markdown 包裹。",
    "Schema 约束：",
    "- 必填字段：passed（boolean）、summary（string）、issues（array）、requiredChanges（array）。",
    "- issues[] 每项必须包含：category、message。",
    "- 不要输出任何额外字段。",
    "",
    "评审目标：",
    "- 脚本必须忠实于 StoryBrief.intent：coreEmotion、tone、narrativeArc、audienceNote、rawUserWords，尤其是 avoidance[]。",
    "- 如果任何字幕与 avoidance 冲突（例如出现被禁止的词/句式/氛围），标记为不通过，并给出具体 requiredChanges。",
    "",
    "检查点（只抓高信号问题）：",
    "- avoidance 冲突：禁用词/禁用句式/禁用氛围（例如用户要克制，你却写得过度煽情）",
    "- tone 不匹配：情绪温度、措辞、节奏与 intent.tone 不一致",
    "- audience 不匹配：若设置了 audienceNote，用词指向要一致（写给“她” vs 写给自己）",
    "- narrativeArc 不匹配：排序与节拍推进应支持 intent.narrativeArc",
    "",
    "若不通过：",
    "- requiredChanges 必须具体、可执行，能够直接转发给脚本编写 Agent（Ocelot）。",
    "- requiredChanges 必须是“要点式”的字符串列表，每条单独可读、可操作。",
    "",
    `Round: ${round}/${maxRounds}`,
    "",
    "StoryBrief（JSON）：",
    JSON.stringify(storyBrief, null, 2),
    "",
    "RenderScript（JSON）：",
    JSON.stringify(renderScript, null, 2),
  ];

  return [{ type: "text" as const, text: promptLines.join("\n") }];
};

