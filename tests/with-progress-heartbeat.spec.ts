import test from "node:test";
import assert from "node:assert/strict";

import { runWithProgressHeartbeat } from "../src/app/workflow/with-progress-heartbeat.ts";

test("runWithProgressHeartbeat emits periodic heartbeat while task is running", async () => {
  const beats: number[] = [];

  const result = await runWithProgressHeartbeat({
    intervalMs: 20,
    onHeartbeat: (elapsedSec) => {
      beats.push(elapsedSec);
    },
    task: async () => {
      await new Promise((resolve) => setTimeout(resolve, 75));
      return "ok";
    },
  });

  assert.equal(result, "ok");
  assert.ok(beats.length >= 2);
});
