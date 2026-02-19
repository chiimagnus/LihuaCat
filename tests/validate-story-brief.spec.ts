import test from "node:test";
import assert from "node:assert/strict";

import { validateStoryBriefStructure } from "../src/subagents/story-brief/validate-story-brief.ts";

test("story-brief structure validation fails when required fields are missing", () => {
  const result = validateStoryBriefStructure({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("intent")));
  assert.ok(result.errors.some((error) => error.includes("photos")));
  assert.ok(result.errors.some((error) => error.includes("narrative")));
});

test("story-brief validation fails when photos length does not match expectedPhotoCount", () => {
  const brief = buildValidBrief();
  const result = validateStoryBriefStructure(brief, { expectedPhotoCount: 2 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("photos length must be 2")));
});

test("valid story-brief passes structure validation", () => {
  const brief = buildValidBrief();
  const result = validateStoryBriefStructure(brief, { expectedPhotoCount: 1 });
  assert.equal(result.valid, true);
});

const buildValidBrief = () => ({
  intent: {
    coreEmotion: "异地重逢的珍贵感",
    tone: "克制的温柔，不煽情",
    narrativeArc: "从期待 → 见面的小确幸 → 离别前的沉默",
    audienceNote: null,
    avoidance: ["不要用'岁月静好'这种词"],
    rawUserWords: "那天我很开心，但又有点舍不得。",
  },
  photos: [
    {
      photoRef: "1.jpg",
      userSaid: "第一次见面",
      emotionalWeight: 0.9,
      suggestedRole: "开场",
      backstory: "我们很久没见了",
      analysis: "两个人在海边合影，光线柔和。",
    },
  ],
  narrative: {
    arc: "期待 → 见面 → 离别",
    beats: [
      {
        photoRefs: ["1.jpg"],
        moment: "重逢",
        emotion: "温柔",
        duration: "short",
        transition: "渐入",
      },
    ],
  },
});
