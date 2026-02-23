import test from "node:test";
import assert from "node:assert/strict";

import { validateCreativePlan, type CreativePlan } from "../src/contracts/creative-plan.types.ts";

test("validateCreativePlan accepts a valid creative plan", () => {
  const plan: CreativePlan = {
    storyBriefRef: "/tmp/run/story-brief.json",
    narrativeArc: {
      opening: "温暖开场",
      development: "轻快推进",
      climax: "情绪拉升",
      resolution: "温柔收束",
    },
    visualDirection: {
      style: "电影感",
      pacing: "medium",
      transitionTone: "克制",
      subtitleStyle: "短句",
    },
    musicIntent: {
      moodKeywords: ["温暖", "怀旧"],
      bpmTrend: "arc",
      keyMoments: [
        { label: "intro", timeMs: 0 },
        { label: "climax", timeMs: 18000 },
      ],
      instrumentationHints: ["钢琴主旋律", "弦乐铺底"],
      durationMs: 30000,
    },
    alignmentPoints: [
      { timeMs: 5000, visualCue: "笑脸特写", musicCue: "和声抬升" },
      { timeMs: 18000, visualCue: "转场推近", musicCue: "鼓点加强" },
    ],
  };

  const result = validateCreativePlan(plan);
  assert.equal(result.valid, true);
  assert.ok(result.plan);
});

test("validateCreativePlan rejects missing musicIntent", () => {
  const result = validateCreativePlan({
    storyBriefRef: "/tmp/run/story-brief.json",
    narrativeArc: {
      opening: "a",
      development: "b",
      climax: "c",
      resolution: "d",
    },
    visualDirection: {
      style: "style",
      pacing: "medium",
      transitionTone: "tone",
      subtitleStyle: "style",
    },
    alignmentPoints: [],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("musicIntent is required")));
});

test("validateCreativePlan rejects key moment outside duration", () => {
  const result = validateCreativePlan({
    storyBriefRef: "/tmp/run/story-brief.json",
    narrativeArc: {
      opening: "a",
      development: "b",
      climax: "c",
      resolution: "d",
    },
    visualDirection: {
      style: "style",
      pacing: "dynamic",
      transitionTone: "tone",
      subtitleStyle: "style",
    },
    musicIntent: {
      moodKeywords: ["warm"],
      bpmTrend: "up",
      keyMoments: [{ label: "late", timeMs: 30001 }],
      instrumentationHints: ["piano"],
      durationMs: 30000,
    },
    alignmentPoints: [],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("timeMs must be <= durationMs")));
});

