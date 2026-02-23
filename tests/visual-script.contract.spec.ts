import test from "node:test";
import assert from "node:assert/strict";

import { validateVisualScript, type VisualScript } from "../src/contracts/visual-script.types.ts";

test("validateVisualScript accepts a valid visual script", () => {
  const script: VisualScript = {
    creativePlanRef: "/tmp/run/creative-plan.json",
    video: { width: 1080, height: 1920, fps: 30 },
    scenes: [
      {
        sceneId: "scene_001",
        photoRef: "1.jpg",
        subtitle: "开场",
        subtitlePosition: "bottom",
        durationSec: 15,
        transition: { type: "dissolve", durationMs: 400 },
        kenBurns: { startScale: 1, endScale: 1.1, panDirection: "left" },
      },
      {
        sceneId: "scene_002",
        photoRef: "2.jpg",
        subtitle: "收束",
        subtitlePosition: "top",
        durationSec: 15,
        transition: { type: "slide", durationMs: 350, direction: "right" },
      },
    ],
  };

  const result = validateVisualScript(script);
  assert.equal(result.valid, true);
  assert.ok(result.script);
});

test("validateVisualScript rejects invalid slide direction", () => {
  const result = validateVisualScript({
    creativePlanRef: "/tmp/run/creative-plan.json",
    video: { width: 1080, height: 1920, fps: 30 },
    scenes: [
      {
        sceneId: "scene_001",
        photoRef: "1.jpg",
        subtitle: "x",
        subtitlePosition: "bottom",
        durationSec: 30,
        transition: { type: "slide", durationMs: 300, direction: "diagonal" },
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("transition.direction")));
});

test("validateVisualScript rejects empty scenes", () => {
  const result = validateVisualScript({
    creativePlanRef: "/tmp/run/creative-plan.json",
    video: { width: 1080, height: 1920, fps: 30 },
    scenes: [],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("non-empty array")));
});

