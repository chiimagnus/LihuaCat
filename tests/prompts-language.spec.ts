import test from "node:test";
import assert from "node:assert/strict";

import { buildTabbyTurnPromptInput } from "../src/agents/tabby/tabby.prompt.ts";
import { buildStoryBriefPromptInput } from "../src/subagents/story-brief/story-brief.prompt.ts";
import { buildRenderScriptPromptInput } from "../src/prompts/render-script.prompt.ts";
import { buildLynxReviewPromptInput } from "../src/prompts/lynx-review.prompt.ts";

test("agent prompts are Chinese and include language rules", () => {
  const tabby = buildTabbyTurnPromptInput({
    photos: [{ photoRef: "1.jpg", path: "/tmp/1.jpg" }],
    conversation: [],
    phase: "start",
    turn: 1,
  });
  assert.equal(tabby[0]?.type, "text");
  assert.match(tabby[0]!.text, /语言规则/);
  assert.doesNotMatch(tabby[0]!.text, /You are Tabby/);

  const storyBrief = buildStoryBriefPromptInput({
    photos: [{ photoRef: "1.jpg", path: "/tmp/1.jpg" }],
    conversation: [],
    confirmedSummary: "summary",
    previousErrors: [],
  });
  assert.equal(storyBrief[0]?.type, "text");
  assert.match(storyBrief[0]!.text, /语言规则/);
  assert.doesNotMatch(storyBrief[0]!.text, /You are generating/);

  const renderScript = buildRenderScriptPromptInput({
    photos: [{ photoRef: "1.jpg", path: "/tmp/1.jpg" }],
    storyBrief: {
      intent: {
        coreEmotion: "relief",
        tone: "restrained",
        narrativeArc: "arc",
        audienceNote: null,
        avoidance: [],
        rawUserWords: "words",
      },
      photos: [],
      narrative: { arc: "arc", beats: [] },
    },
    video: { width: 1080, height: 1920, fps: 30 },
    revisionNotes: [],
  });
  assert.equal(renderScript[0]?.type, "text");
  assert.match(renderScript[0]!.text, /语言规则/);
  assert.doesNotMatch(renderScript[0]!.text, /You are Ocelot/);

  const lynx = buildLynxReviewPromptInput({
    storyBrief: {
      intent: {
        coreEmotion: "relief",
        tone: "restrained",
        narrativeArc: "arc",
        audienceNote: null,
        avoidance: [],
        rawUserWords: "words",
      },
      photos: [],
      narrative: { arc: "arc", beats: [] },
    },
    renderScript: {
      storyBriefRef: "ref",
      video: { width: 1080, height: 1920, fps: 30 },
      scenes: [],
    },
    round: 1,
    maxRounds: 3,
  });
  assert.equal(lynx[0]?.type, "text");
  assert.match(lynx[0]!.text, /语言规则/);
  assert.doesNotMatch(lynx[0]!.text, /You are Lynx/);
});
