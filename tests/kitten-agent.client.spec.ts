import test from "node:test";
import assert from "node:assert/strict";

import {
  createCodexKittenAgentClient,
  KittenAgentResponseParseError,
  type GenerateKittenVisualScriptRequest,
} from "../src/subagents/kitten/kitten.client.ts";

test("calls Codex SDK with model override and returns validated visual script", async () => {
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

  const client = createCodexKittenAgentClient({
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
            return { finalResponse: JSON.stringify(buildValidVisualScript(), null, 2) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const result = await client.generateVisualScript(buildRequest());
  assert.equal(result.scenes.length, 2);
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
  const client = createCodexKittenAgentClient({
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

  await assert.rejects(
    client.generateVisualScript(buildRequest()),
    KittenAgentResponseParseError,
  );
});

test("throws parse error when visual script misses expected photo refs", async () => {
  const client = createCodexKittenAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            const invalid = buildValidVisualScript();
            invalid.scenes = [invalid.scenes[0]!];
            return { finalResponse: JSON.stringify(invalid) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await assert.rejects(client.generateVisualScript(buildRequest()), /photoRef/i);
});

test("propagates auth failure before calling SDK", async () => {
  let called = false;
  const client = createCodexKittenAgentClient({
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

  await assert.rejects(client.generateVisualScript(buildRequest()), /missing auth/);
  assert.equal(called, false);
});

const buildRequest = (): GenerateKittenVisualScriptRequest => ({
  creativePlanRef: "/tmp/run/creative-plan.json",
  creativePlan: {
    storyBriefRef: "/tmp/run/story-brief.json",
    narrativeArc: {
      opening: "warm",
      development: "lift",
      climax: "peak",
      resolution: "calm",
    },
    visualDirection: {
      style: "film",
      pacing: "medium",
      transitionTone: "restrained",
      subtitleStyle: "short",
    },
    musicIntent: {
      moodKeywords: ["warm"],
      bpmTrend: "arc",
      keyMoments: [{ label: "climax", timeMs: 15000 }],
      instrumentationHints: ["piano"],
      durationMs: 30000,
    },
    alignmentPoints: [],
  },
  photos: [
    { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
    { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
  ],
});

const buildValidVisualScript = () => ({
  creativePlanRef: "/tmp/run/creative-plan.json",
  video: { width: 1080, height: 1920, fps: 30 },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom" as const,
      durationSec: 15,
      transition: { type: "cut" as const, durationMs: 0 },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle: "second",
      subtitlePosition: "bottom" as const,
      durationSec: 15,
      transition: { type: "fade" as const, durationMs: 300 },
    },
  ],
});

