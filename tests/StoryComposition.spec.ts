import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultStoryTemplateProps } from "../src/story-template/StoryComposition.schema.ts";
import {
  buildTemplateSequences,
  secondsToFrames,
} from "../src/story-template/StoryComposition.logic.ts";

test("secondsToFrames keeps at least 1 frame", () => {
  assert.equal(secondsToFrames(0, 30), 1);
  assert.equal(secondsToFrames(0.2, 30), 6);
});

test("buildTemplateSequences maps timeline to frame ranges", () => {
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

  const sequences = buildTemplateSequences(props, 30);
  assert.equal(sequences.length, 2);
  assert.deepEqual(
    sequences.map((item) => item.from),
    [0, 300],
  );
  assert.deepEqual(
    sequences.map((item) => item.durationInFrames),
    [300, 600],
  );
  assert.deepEqual(
    sequences.map((item) => item.subtitle),
    ["first", "second"],
  );
  assert.deepEqual(
    sequences.map((item) => item.subtitlePosition),
    ["bottom", "top"],
  );
});
