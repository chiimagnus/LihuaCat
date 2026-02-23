import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultStoryTemplateProps } from "../src/templates/remotion/StoryComposition.schema.ts";
import {
  buildSceneWindows,
  computeStoryDurationInFrames,
  computeKenBurnsTransform,
  computeSceneLayers,
  msToFrames,
  secondsToFrames,
} from "../src/templates/remotion/StoryComposition.logic.ts";

test("secondsToFrames keeps at least 1 frame", () => {
  assert.equal(secondsToFrames(0, 30), 1);
  assert.equal(secondsToFrames(0.2, 30), 6);
});

test("buildSceneWindows maps scenes to frame windows", () => {
  const props = createDefaultStoryTemplateProps();
  assert.ok("scenes" in props);
  props.assets = [
    { photoRef: "1.jpg", path: "/tmp/1.jpg" },
    { photoRef: "2.jpg", path: "/tmp/2.jpg" },
  ];
  props.scenes = [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom",
      durationSec: 10,
      transition: { type: "cut", durationMs: 0 },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle: "second",
      subtitlePosition: "top",
      durationSec: 20,
      transition: { type: "cut", durationMs: 0 },
    },
  ];

  const windows = buildSceneWindows(props, 30);
  assert.equal(windows.length, 2);
  assert.deepEqual(
    windows.map((item) => item.startFrame),
    [0, 300],
  );
  assert.deepEqual(
    windows.map((item) => item.endFrame),
    [300, 900],
  );
  assert.deepEqual(
    windows.map((item) => item.subtitle),
    ["first", "second"],
  );
  assert.deepEqual(
    windows.map((item) => item.subtitlePosition),
    ["bottom", "top"],
  );
});

test("computeSceneLayers returns two layers during dissolve transition", () => {
  const props = createDefaultStoryTemplateProps();
  assert.ok("scenes" in props);
  props.assets = [
    { photoRef: "1.jpg", path: "/tmp/1.jpg" },
    { photoRef: "2.jpg", path: "/tmp/2.jpg" },
  ];
  props.scenes = [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom",
      durationSec: 10,
      transition: { type: "dissolve", durationMs: 1000, direction: "left" },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle: "second",
      subtitlePosition: "bottom",
      durationSec: 20,
      transition: { type: "cut", durationMs: 0, direction: "left" },
    },
  ];

  const fps = 30;
  const windows = buildSceneWindows(props, fps);
  const transitionFrames = secondsToFrames(1, fps);
  const transitionStart = windows[0]!.endFrame - transitionFrames;
  const layers = computeSceneLayers(windows, transitionStart + 1, fps);
  assert.equal(layers.length, 2);
  assert.ok(layers[0]!.opacity < 1);
  assert.ok(layers[1]!.opacity > 0);
});

test("computeKenBurnsTransform pans left while scaling up", () => {
  const result = computeKenBurnsTransform(
    { startScale: 1, endScale: 1.2, panDirection: "left" },
    1,
    { width: 1080, height: 1920 },
  );
  assert.equal(result.scale, 1.2);
  assert.ok(result.translateX < 0);
  assert.equal(result.translateY, 0);
});

test("computeStoryDurationInFrames uses max(video, audio) length", () => {
  const props = createDefaultStoryTemplateProps();
  props.assets = [{ photoRef: "1.jpg", path: "/tmp/1.jpg" }];
  props.scenes = [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom",
      durationSec: 20,
      transition: { type: "cut", durationMs: 0 },
    },
  ];
  props.audioTrack = {
    path: "/tmp/music.wav",
    format: "wav",
    startMs: 5000,
    durationSec: 30,
  };

  const duration = computeStoryDurationInFrames(props, 30);
  assert.equal(duration, msToFrames(5000, 30) + secondsToFrames(30, 30));
});
