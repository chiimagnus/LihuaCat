import test from "node:test";
import assert from "node:assert/strict";

import {
  validateRenderScriptSemantics,
  validateRenderScriptStructure,
} from "../src/agents/ocelot/ocelot.validate.ts";
import type { RenderScript } from "../src/contracts/render-script.types.ts";

test("render-script structure validation fails when required fields are missing", () => {
  const result = validateRenderScriptStructure({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("storyBriefRef")));
  assert.ok(result.errors.some((error) => error.includes("video")));
  assert.ok(result.errors.some((error) => error.includes("scenes")));
});

test("semantic validation fails when fixed video spec does not match", () => {
  const script = buildValidRenderScript();
  script.video.fps = 60;
  const result = validateRenderScriptSemantics(script, {
    fixedVideo: { width: 1080, height: 1920, fps: 30 },
    expectedTotalDurationSec: 30,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("video.fps must be 30")));
});

test("semantic validation fails when total duration does not match expected", () => {
  const script = buildValidRenderScript();
  script.scenes[0]!.durationSec = 10;
  const result = validateRenderScriptSemantics(script, {
    expectedTotalDurationSec: 30,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("total duration")));
});

test("semantic validation fails when per-scene rounding yields wrong total frames", () => {
  const script: RenderScript = {
    storyBriefRef: "/tmp/run/story-brief.json",
    video: { width: 1080, height: 1920, fps: 30 },
    scenes: [
      {
        sceneId: "scene_001",
        photoRef: "1.jpg",
        subtitle: "a",
        subtitlePosition: "bottom",
        durationSec: 1 / 60,
        transition: { type: "cut", durationMs: 0 },
      },
      {
        sceneId: "scene_002",
        photoRef: "2.jpg",
        subtitle: "b",
        subtitlePosition: "bottom",
        durationSec: 30 - 1 / 60,
        transition: { type: "cut", durationMs: 0 },
      },
    ],
  };

  const result = validateRenderScriptSemantics(script, {
    fixedVideo: { width: 1080, height: 1920, fps: 30 },
    expectedTotalDurationSec: 30,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("total frames")));
});

test("semantic validation fails when not all expected photos are used", () => {
  const script = buildValidRenderScript();
  script.scenes = [script.scenes[0]!];
  const result = validateRenderScriptSemantics(script, {
    expectedTotalDurationSec: 30,
    expectedPhotoRefs: ["1.jpg", "2.jpg"],
    requireAllPhotosUsed: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("2.jpg")));
});

test("semantic validation fails when slide direction is not allowed", () => {
  const script = buildValidRenderScript();
  script.scenes[0]!.transition = { type: "slide", durationMs: 300, direction: "up" };
  const result = validateRenderScriptSemantics(script, {
    expectedTotalDurationSec: 30,
    allowedSlideDirections: ["left", "right"],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("direction must be one of")));
});

test("valid render-script passes both structure and semantic checks", () => {
  const script = buildValidRenderScript();
  const structure = validateRenderScriptStructure(script);
  assert.equal(structure.valid, true);
  const semantic = validateRenderScriptSemantics(script, {
    fixedVideo: { width: 1080, height: 1920, fps: 30 },
    expectedTotalDurationSec: 30,
    expectedPhotoRefs: ["1.jpg", "2.jpg"],
    requireAllPhotosUsed: true,
    allowedSlideDirections: ["left", "right"],
  });
  assert.equal(semantic.valid, true);
});

test("render-script structure accepts optional audioTrack", () => {
  const script = buildValidRenderScript();
  script.audioTrack = {
    path: "/tmp/run/music.wav",
    format: "wav",
    startMs: 0,
    gain: 0.9,
  };
  const structure = validateRenderScriptStructure(script);
  assert.equal(structure.valid, true);
});

test("render-script structure rejects invalid audioTrack fields", () => {
  const script = buildValidRenderScript();
  script.audioTrack = {
    path: "/tmp/run/music.ogg",
    format: "ogg" as never,
    startMs: -1,
  };
  const structure = validateRenderScriptStructure(script);
  assert.equal(structure.valid, false);
  assert.ok(structure.errors.some((error) => error.includes("audioTrack.format")));
  assert.ok(structure.errors.some((error) => error.includes("audioTrack.startMs")));
});

const buildValidRenderScript = (): RenderScript => ({
  storyBriefRef: "/tmp/run/story-brief.json",
  video: { width: 1080, height: 1920, fps: 30 },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "fade", durationMs: 300 },
      kenBurns: { startScale: 1, endScale: 1.1, panDirection: "left" },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle: "second",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "cut", durationMs: 0 },
    },
  ],
});
