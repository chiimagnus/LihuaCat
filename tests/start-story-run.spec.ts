import test from "node:test";
import assert from "node:assert/strict";

import { startStoryRun } from "../src/app/workflow/start-story-run.ts";

test("startStoryRun returns runId and outputDir", () => {
  const result = startStoryRun({
    sourceDir: "/tmp/photos",
    now: new Date(2026, 1, 8, 10, 20, 30),
  });

  assert.match(result.runId, /^20260208-102030-[a-z0-9]{8}$/);
  assert.equal(
    result.outputDir,
    `/tmp/photos/lihuacat-output/${result.runId}`,
  );
});
