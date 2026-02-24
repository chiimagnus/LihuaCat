import test from "node:test";
import assert from "node:assert/strict";

import { validateKittenOutput } from "../src/subagents/kitten/kitten.validate.ts";
import type { CreativePlan } from "../src/contracts/creative-plan.types.ts";
import type { VisualScript } from "../src/contracts/visual-script.types.ts";

const creativePlan: CreativePlan = {
  storyBriefRef: "/tmp/run/story-brief.json",
  narrativeArc: {
    opening: "warm",
    development: "lift",
    climax: "peak",
    resolution: "calm",
  },
  visualDirection: {
    style: "film",
    pacing: "medium",
    transitionTone: "restrained",
    subtitleStyle: "short",
  },
  musicIntent: {
    moodKeywords: ["warm", "nostalgic"],
    bpmTrend: "arc",
    keyMoments: [{ label: "climax", timeMs: 15000 }],
    instrumentationHints: ["piano"],
    durationMs: 30000,
  },
  alignmentPoints: [],
};

const buildVisualScript = (): VisualScript => ({
  creativePlanRef: "/tmp/run/creative-plan.json",
  video: { width: 1080, height: 1920, fps: 30 },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "开场",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "fade", durationMs: 300 },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle: "收束",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "cut", durationMs: 0 },
    },
  ],
});

test("validateKittenOutput accepts valid visual script", () => {
  const result = validateKittenOutput(buildVisualScript(), {
    creativePlan,
    expectedPhotoRefs: ["1.jpg", "2.jpg"],
    expectedTotalDurationSec: 30,
  });
  assert.equal(result.valid, true);
  assert.ok(result.script);
});

test("validateKittenOutput rejects missing expected photoRef", () => {
  const script = buildVisualScript();
  script.scenes = [script.scenes[0]!];

  const result = validateKittenOutput(script, {
    creativePlan,
    expectedPhotoRefs: ["1.jpg", "2.jpg"],
    expectedTotalDurationSec: 30,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("2.jpg")));
});

test("validateKittenOutput rejects duration mismatch with expected visual duration", () => {
  const script = buildVisualScript();
  script.scenes[0]!.durationSec = 10;

  const result = validateKittenOutput(script, {
    creativePlan,
    expectedPhotoRefs: ["1.jpg", "2.jpg"],
    expectedTotalDurationSec: 30,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("total visual duration")));
});

test("validateKittenOutput accepts non-30 target durations when expected total matches", () => {
  const script = buildVisualScript();
  script.scenes[0]!.durationSec = 32.5;
  script.scenes[1]!.durationSec = 32.5;

  const result = validateKittenOutput(script, {
    creativePlan,
    expectedPhotoRefs: ["1.jpg", "2.jpg"],
    expectedTotalDurationSec: 65,
  });

  assert.equal(result.valid, true);
  assert.ok(result.script);
});
