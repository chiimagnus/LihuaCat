import test from "node:test";
import assert from "node:assert/strict";

import { validateStoryScriptStructure } from "./validate-story-script.ts";
import { validateStoryScriptSemantics } from "./validate-story-script.semantics.ts";
import type { StoryScript } from "../../contracts/story-script.types.ts";

test("structure validation fails when required fields are missing", () => {
  const result = validateStoryScriptStructure({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("version")));
  assert.ok(result.errors.some((error) => error.includes("input")));
});

test("semantic validation fails for invalid total duration", () => {
  const script = buildValidScript();
  script.timeline[0]!.endSec = 9;
  const result = validateStoryScriptSemantics(script, { expectedDurationSec: 30 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("total duration")));
});

test("semantic validation fails when not all assets are used", () => {
  const script = buildValidScript();
  script.timeline = [script.timeline[0]!];
  const result = validateStoryScriptSemantics(script, {
    expectedDurationSec: 30,
    requireAllAssetsUsed: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("is not used")));
});

test("semantic validation fails when item duration is below minimum", () => {
  const script = buildValidScript();
  script.timeline[0]!.endSec = 0.5;
  script.timeline[1]!.startSec = 0.5;
  const result = validateStoryScriptSemantics(script, {
    expectedDurationSec: 30,
    minDurationPerAssetSec: 1,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("duration must be >=")));
});

test("valid story script passes both structure and semantics checks", () => {
  const script = buildValidScript();
  const structure = validateStoryScriptStructure(script);
  assert.equal(structure.valid, true);
  const semantic = validateStoryScriptSemantics(script, { expectedDurationSec: 30 });
  assert.equal(semantic.valid, true);
});

const buildValidScript = (): StoryScript => ({
  version: "1.0",
  input: {
    sourceDir: "/tmp/input",
    imageCount: 2,
    assets: [
      { id: "img_001", path: "/tmp/input/1.jpg" },
      { id: "img_002", path: "/tmp/input/2.jpg" },
    ],
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationSec: 30,
  },
  style: {
    preset: "healing",
  },
  timeline: [
    { assetId: "img_001", startSec: 0, endSec: 10, subtitleId: "sub_1" },
    { assetId: "img_002", startSec: 10, endSec: 30, subtitleId: "sub_2" },
  ],
  subtitles: [
    { id: "sub_1", text: "first", startSec: 0, endSec: 10 },
    { id: "sub_2", text: "second", startSec: 10, endSec: 30 },
  ],
});
