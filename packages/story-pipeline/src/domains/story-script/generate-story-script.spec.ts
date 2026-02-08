import test from "node:test";
import assert from "node:assert/strict";

import {
  generateStoryScript,
  StoryScriptGenerationFailedError,
} from "./generate-story-script.ts";
import type { StoryAgentClient } from "./story-agent.client.ts";
import type { StoryScript } from "../../contracts/story-script.types.ts";

test("retries until script becomes valid", async () => {
  const client = new QueueStoryAgentClient([
    {},
    {
      version: "1.0",
      input: { sourceDir: "/tmp/photos", imageCount: 1, assets: [{ id: "img_001", path: "a.jpg" }] },
      video: { width: 1080, height: 1920, fps: 30, durationSec: 30 },
      style: { preset: "fairytale" },
      timeline: [{ assetId: "img_001", startSec: 0, endSec: 30, subtitleId: "sub_1" }],
      subtitles: [{ id: "sub_1", text: "hello", startSec: 0, endSec: 30 }],
    },
  ]);

  const result = await generateStoryScript({
    sourceDir: "/tmp/photos",
    assets: [{ id: "img_001", path: "a.jpg" }],
    style: { preset: "fairytale" },
    client,
  });

  assert.equal(result.attempts, 2);
  assert.equal(result.script.version, "1.0");
});

test("throws after retries are exhausted", async () => {
  const client = new QueueStoryAgentClient([
    {},
    { invalid: true },
    { alsoInvalid: true },
  ]);

  await assert.rejects(
    generateStoryScript({
      sourceDir: "/tmp/photos",
      assets: [{ id: "img_001", path: "a.jpg" }],
      style: { preset: "fairytale" },
      client,
    }),
    (error: unknown) => {
      assert.ok(error instanceof StoryScriptGenerationFailedError);
      assert.equal(error.attempts, 3);
      assert.ok(error.reasons.length >= 3);
      return true;
    },
  );
});

test("keeps semantic constraints: each asset must appear and total is 30s", async () => {
  const invalidSemantic: StoryScript = {
    version: "1.0",
    input: {
      sourceDir: "/tmp/photos",
      imageCount: 2,
      assets: [
        { id: "img_001", path: "1.jpg" },
        { id: "img_002", path: "2.jpg" },
      ],
    },
    video: { width: 1080, height: 1920, fps: 30, durationSec: 30 },
    style: { preset: "fairytale" },
    timeline: [{ assetId: "img_001", startSec: 0, endSec: 20, subtitleId: "sub_1" }],
    subtitles: [{ id: "sub_1", text: "hello", startSec: 0, endSec: 20 }],
  };

  const valid: StoryScript = {
    ...invalidSemantic,
    timeline: [
      { assetId: "img_001", startSec: 0, endSec: 10, subtitleId: "sub_1" },
      { assetId: "img_002", startSec: 10, endSec: 30, subtitleId: "sub_2" },
    ],
    subtitles: [
      { id: "sub_1", text: "hello", startSec: 0, endSec: 10 },
      { id: "sub_2", text: "world", startSec: 10, endSec: 30 },
    ],
  };

  const client = new QueueStoryAgentClient([invalidSemantic, valid]);
  const result = await generateStoryScript({
    sourceDir: "/tmp/photos",
    assets: [
      { id: "img_001", path: "1.jpg" },
      { id: "img_002", path: "2.jpg" },
    ],
    style: { preset: "fairytale" },
    client,
  });
  assert.equal(result.attempts, 2);
});

class QueueStoryAgentClient implements StoryAgentClient {
  private readonly queue: unknown[];

  constructor(queue: unknown[]) {
    this.queue = [...queue];
  }

  async generateStoryScript(): Promise<unknown> {
    if (this.queue.length === 0) {
      throw new Error("queue empty");
    }
    return this.queue.shift();
  }
}
