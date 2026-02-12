import test from "node:test";
import assert from "node:assert/strict";

import {
  generateStoryBrief,
  StoryBriefGenerationFailedError,
} from "../src/domains/story-brief/generate-story-brief.ts";

test("generateStoryBrief retries and succeeds when structure validation passes", async () => {
  const calls: Array<{ attempt: number; previousErrors: string[] }> = [];

  const result = await generateStoryBrief({
    photos: [
      { photoRef: "1.jpg", path: "/tmp/1.jpg" },
      { photoRef: "2.jpg", path: "/tmp/2.jpg" },
    ],
    conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
    confirmedSummary: "summary",
    client: {
      async generateStoryBrief({ attempt, previousErrors }) {
        calls.push({ attempt, previousErrors: [...previousErrors] });
        if (attempt === 1) {
          return {};
        }
        return buildValidStoryBrief(["1.jpg", "2.jpg"]);
      },
    },
    maxRetries: 2,
  });

  assert.equal(result.attempts, 2);
  assert.equal(result.brief.photos.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.attempt, 1);
  assert.equal(calls[1]!.attempt, 2);
  assert.ok(calls[1]!.previousErrors.length > 0);
});

test("generateStoryBrief throws after retries are exhausted", async () => {
  await assert.rejects(
    generateStoryBrief({
      photos: [{ photoRef: "1.jpg", path: "/tmp/1.jpg" }],
      conversation: [],
      confirmedSummary: "summary",
      client: {
        async generateStoryBrief() {
          return {};
        },
      },
      maxRetries: 1,
    }),
    StoryBriefGenerationFailedError,
  );
});

const buildValidStoryBrief = (photoRefs: string[]) => ({
  intent: {
    coreEmotion: "释然",
    tone: "克制的温柔",
    narrativeArc: "起→承→转→合",
    audienceNote: null,
    avoidance: ["不要岁月静好"],
    rawUserWords: "就是那种说不清的轻。",
  },
  photos: photoRefs.map((ref, index) => ({
    photoRef: ref,
    userSaid: index === 0 ? "这张像开始" : "这张像收尾",
    emotionalWeight: 0.5,
    suggestedRole: index === 0 ? "开场" : "收尾",
    backstory: "一些背景",
    analysis: "视觉描述",
  })),
  narrative: {
    arc: "起→承→转→合",
    beats: [
      {
        photoRefs,
        moment: "一个瞬间",
        emotion: "温柔",
        duration: "short",
        transition: "渐入",
      },
    ],
  },
});
