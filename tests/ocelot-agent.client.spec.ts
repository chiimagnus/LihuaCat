import test from "node:test";
import assert from "node:assert/strict";

import {
  createCodexOcelotAgentClient,
  OcelotAgentResponseParseError,
  type GenerateRenderScriptRequest,
} from "../src/agents/ocelot/ocelot.client.ts";

test("calls Codex SDK with model override and returns validated render-script", async () => {
  const calls: {
    threadOptions?: {
      model?: string;
      modelReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
      workingDirectory?: string;
      skipGitRepoCheck?: boolean;
    };
    runInput?: unknown;
    runOptions?: unknown;
  } = {};

  const client = createCodexOcelotAgentClient({
    model: "gpt-5-codex",
    modelReasoningEffort: "high",
    workingDirectory: "/tmp/project",
    codexFactory: () => ({
      startThread(options) {
        calls.threadOptions = options;
        return {
          async run(input, options2) {
            calls.runInput = input;
            calls.runOptions = options2;
            return { finalResponse: JSON.stringify(buildValidRenderScript(), null, 2) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const result = await client.generateRenderScript(buildRequest());
  assert.equal(result.video.fps, 30);
  assert.equal(calls.threadOptions?.model, "gpt-5-codex");
  assert.equal(calls.threadOptions?.modelReasoningEffort, "high");
  assert.equal(calls.threadOptions?.workingDirectory, "/tmp/project");
  assert.equal(calls.threadOptions?.skipGitRepoCheck, true);
  assert.deepEqual(
    (calls.runInput as Array<{ type: string }>).map((item) => item.type),
    ["text", "local_image", "local_image"],
  );
  assert.ok((calls.runOptions as { outputSchema?: unknown }).outputSchema);
});

test("throws parse error when SDK returns non-JSON content", async () => {
  const client = createCodexOcelotAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            return { finalResponse: "not json" };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await assert.rejects(client.generateRenderScript(buildRequest()), OcelotAgentResponseParseError);
});

test("throws parse error when render-script violates semantic rules", async () => {
  const client = createCodexOcelotAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            const invalid = buildValidRenderScript();
            invalid.video.fps = 60;
            return { finalResponse: JSON.stringify(invalid) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await assert.rejects(client.generateRenderScript(buildRequest()), /semantics invalid/i);
});

test("propagates auth failure before calling SDK", async () => {
  let called = false;
  const client = createCodexOcelotAgentClient({
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

  await assert.rejects(client.generateRenderScript(buildRequest()), /missing auth/);
  assert.equal(called, false);
});

const buildRequest = (): GenerateRenderScriptRequest => ({
  storyBriefRef: "/tmp/run/story-brief.json",
  storyBrief: {
    intent: {
      coreEmotion: "释然",
      tone: "克制",
      narrativeArc: "起→承→转→合",
      audienceNote: null,
      avoidance: ["不要岁月静好"],
      rawUserWords: "很轻。",
    },
    photos: [
      {
        photoRef: "1.jpg",
        userSaid: "",
        emotionalWeight: 0.5,
        suggestedRole: "开场",
        backstory: "",
        analysis: "视觉描述",
      },
      {
        photoRef: "2.jpg",
        userSaid: "",
        emotionalWeight: 0.5,
        suggestedRole: "收尾",
        backstory: "",
        analysis: "视觉描述",
      },
    ],
    narrative: {
      arc: "起→承→转→合",
      beats: [
        {
          photoRefs: ["1.jpg", "2.jpg"],
          moment: "一个瞬间",
          emotion: "温柔",
          duration: "short",
          transition: "渐入",
        },
      ],
    },
  },
  photos: [
    { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
    { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
  ],
  video: { width: 1080, height: 1920, fps: 30 },
});

const buildValidRenderScript = () => ({
  storyBriefRef: "/tmp/run/story-brief.json",
  video: { width: 1080, height: 1920, fps: 30 },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "fade", durationMs: 300 },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle: "second",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "cut", durationMs: 0 },
    },
  ],
});
