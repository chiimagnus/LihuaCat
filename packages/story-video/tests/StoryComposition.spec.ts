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
  props.input.assets = [
    { id: "img_001", path: "/tmp/1.jpg" },
    { id: "img_002", path: "/tmp/2.jpg" },
  ];
  props.timeline = [
    { assetId: "img_001", startSec: 0, endSec: 10, subtitleId: "sub_001" },
    { assetId: "img_002", startSec: 10, endSec: 30, subtitleId: "sub_002" },
  ];
  props.subtitles = [
    { id: "sub_001", text: "first", startSec: 0, endSec: 10 },
    { id: "sub_002", text: "second", startSec: 10, endSec: 30 },
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
});
