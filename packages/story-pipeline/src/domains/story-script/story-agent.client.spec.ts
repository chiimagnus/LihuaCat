import test from "node:test";
import assert from "node:assert/strict";

import {
  createCodexStoryAgentClient,
  StoryAgentResponseParseError,
  type GenerateStoryScriptRequest,
} from "./story-agent.client.ts";

test("calls Codex SDK with model override and parses JSON result", async () => {
  const calls: {
    threadOptions?: { model?: string; workingDirectory?: string; skipGitRepoCheck?: boolean };
    runInput?: unknown;
    runOptions?: unknown;
  } = {};

  const client = createCodexStoryAgentClient({
    model: "gpt-5-codex",
    workingDirectory: "/tmp/project",
    codexFactory: () => ({
      startThread(options) {
        calls.threadOptions = options;
        return {
          async run(input, turnOptions) {
            calls.runInput = input;
            calls.runOptions = turnOptions;
            return {
              finalResponse: JSON.stringify(buildValidStoryScript(), null, 2),
            };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const result = await client.generateStoryScript(buildRequest());
  assert.equal((result as { version: string }).version, "1.0");
  assert.equal(calls.threadOptions?.model, "gpt-5-codex");
  assert.equal(calls.threadOptions?.workingDirectory, "/tmp/project");
  assert.equal(calls.threadOptions?.skipGitRepoCheck, true);
  assert.deepEqual(
    (calls.runInput as Array<{ type: string }>).map((item) => item.type),
    ["text", "local_image", "local_image"],
  );
  assert.ok((calls.runOptions as { outputSchema?: unknown }).outputSchema);
});

test("throws parse error when SDK returns non-JSON content", async () => {
  const client = createCodexStoryAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            return {
              finalResponse: "This is not JSON",
            };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await assert.rejects(client.generateStoryScript(buildRequest()), StoryAgentResponseParseError);
});

test("propagates auth failure before calling SDK", async () => {
  let called = false;
  const client = createCodexStoryAgentClient({
    codexFactory: () => ({
      startThread() {
        called = true;
        return {
          async run() {
            return { finalResponse: "{}" };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      throw new Error("missing auth");
    },
  });

  await assert.rejects(client.generateStoryScript(buildRequest()), /missing auth/);
  assert.equal(called, false);
});

const buildRequest = (): GenerateStoryScriptRequest => ({
  sourceDir: "/tmp/photos",
  assets: [
    { id: "img_001", path: "/tmp/photos/1.jpg" },
    { id: "img_002", path: "/tmp/photos/2.jpg" },
  ],
  style: {
    preset: "healing",
    prompt: "calm and warm",
  },
  constraints: {
    durationSec: 30,
    minDurationPerAssetSec: 1,
    requireAllAssetsUsed: true,
  },
  attempt: 1,
  previousErrors: [],
});

const buildValidStoryScript = () => ({
  version: "1.0",
  input: {
    sourceDir: "/tmp/photos",
    imageCount: 2,
    assets: [
      { id: "img_001", path: "/tmp/photos/1.jpg" },
      { id: "img_002", path: "/tmp/photos/2.jpg" },
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
    { assetId: "img_001", startSec: 0, endSec: 15, subtitleId: "sub_1" },
    { assetId: "img_002", startSec: 15, endSec: 30, subtitleId: "sub_2" },
  ],
  subtitles: [
    { id: "sub_1", text: "first", startSec: 0, endSec: 15 },
    { id: "sub_2", text: "second", startSec: 15, endSec: 30 },
  ],
});
