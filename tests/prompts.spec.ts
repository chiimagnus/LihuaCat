import test from "node:test";
import assert from "node:assert/strict";

import { buildStoryScriptPromptInput } from "../src/prompts/story-script.prompt.ts";

test("buildStoryScriptPromptInput includes constraints and assets", () => {
  const input = buildStoryScriptPromptInput({
    sourceDir: "/tmp/photos",
    assets: [
      { id: "img_001", path: "/tmp/photos/1.jpg" },
      { id: "img_002", path: "/tmp/photos/2.jpg" },
    ],
    style: { preset: "healing", prompt: "spring" },
    constraints: {
      durationSec: 30,
      minDurationPerAssetSec: 1,
      requireAllAssetsUsed: true,
    },
    attempt: 1,
    previousErrors: ["attempt 1: duration mismatch"],
  });

  assert.equal(input[0]?.type, "text");
  assert.match(input[0]?.text ?? "", /Return JSON only/);
  assert.match(input[0]?.text ?? "", /durationSec must equal 30/);
  assert.match(input[0]?.text ?? "", /img_001: \/tmp\/photos\/1\.jpg/);
  assert.match(input[0]?.text ?? "", /Previous validation errors to fix:/);

  assert.equal(input[1]?.type, "local_image");
  assert.equal(input[2]?.type, "local_image");
});

