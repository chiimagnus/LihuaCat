import type { StoryBrief } from "../contracts/story-brief.types.ts";
import type { RenderScript } from "../contracts/render-script.types.ts";

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
}: BuildLynxReviewPromptInputRequest) => {
  const promptLines = [
    "You are Lynx (猞猁), the reviewer agent of LihuaCat.",
    "You will review whether a RenderScript faithfully expresses the StoryBrief's narrative intent.",
    "",
    "Output format (STRICT): Return JSON only. Do not wrap with markdown.",
    "",
    "Review objective:",
    "- The script must be faithful to StoryBrief.intent: coreEmotion, tone, narrativeArc, audienceNote, rawUserWords, and especially avoidance[].",
    "- If any subtitle conflicts with avoidance (e.g. forbidden phrases like '岁月静好'), mark as NOT passed and include concrete requiredChanges.",
    "",
    "What to check (focus on high-signal issues):",
    "- avoidance conflicts: forbidden words/phrases, forbidden vibe (e.g. overly sentimental when asked to be restrained)",
    "- tone mismatch: emotional temperature, diction, pacing vs intent.tone",
    "- audience mismatch: if audienceNote is set, wording should match (e.g. to 'her' vs to self)",
    "- narrative arc mismatch: ordering/beat progression should support intent.narrativeArc",
    "",
    "If NOT passed:",
    "- requiredChanges must be specific and actionable, suitable to forward directly to the scriptwriter agent (Ocelot).",
    "- requiredChanges must be a list of bullet-like strings; each item should be independently understandable.",
    "",
    `Round: ${round}/${maxRounds}`,
    "",
    "StoryBrief (JSON):",
    JSON.stringify(storyBrief, null, 2),
    "",
    "RenderScript (JSON):",
    JSON.stringify(renderScript, null, 2),
  ];

  return [{ type: "text" as const, text: promptLines.join("\n") }];
};

export const lynxReviewOutputSchema = {
  type: "object",
  required: ["passed", "summary", "issues", "requiredChanges"],
  additionalProperties: false,
  properties: {
    passed: { type: "boolean" },
    summary: { type: "string", minLength: 1 },
    issues: {
      type: "array",
      items: {
        type: "object",
        required: ["category", "message"],
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: [
              "avoidance_conflict",
              "tone_mismatch",
              "audience_mismatch",
              "narrative_arc_mismatch",
              "other",
            ],
          },
          message: { type: "string", minLength: 1 },
        },
      },
    },
    requiredChanges: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
} as const;
