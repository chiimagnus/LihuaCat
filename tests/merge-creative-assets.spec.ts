import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeCreativeAssets,
  MergeCreativeAssetsError,
} from "../src/tools/render/merge-creative-assets.ts";
import type { VisualScript } from "../src/contracts/visual-script.types.ts";

const buildVisualScript = (): VisualScript => ({
  creativePlanRef: "/tmp/run/creative-plan.json",
  video: { width: 1080, height: 1920, fps: 30 },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "cut", durationMs: 0 },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle: "second",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "fade", durationMs: 300 },
    },
  ],
});

test("mergeCreativeAssets merges visual script and optional audio track deterministically", () => {
  const merged = mergeCreativeAssets({
    storyBriefRef: "/tmp/run/story-brief.json",
    visualScript: buildVisualScript(),
    audioTrack: {
      path: "/tmp/run/music.wav",
      format: "wav",
      startMs: 0,
      gain: 0.9,
    },
  });

  assert.equal(merged.storyBriefRef, "/tmp/run/story-brief.json");
  assert.equal(merged.scenes.length, 2);
  assert.equal(merged.audioTrack?.path, "/tmp/run/music.wav");
  assert.equal(merged.audioTrack?.format, "wav");
});

test("mergeCreativeAssets supports visual-only output", () => {
  const merged = mergeCreativeAssets({
    storyBriefRef: "/tmp/run/story-brief.json",
    visualScript: buildVisualScript(),
  });
  assert.equal(merged.audioTrack, undefined);
});

test("mergeCreativeAssets rejects invalid visual script", () => {
  const invalid = buildVisualScript();
  invalid.scenes = [];
  assert.throws(
    () =>
      mergeCreativeAssets({
        storyBriefRef: "/tmp/run/story-brief.json",
        visualScript: invalid,
      }),
    MergeCreativeAssetsError,
  );
});

