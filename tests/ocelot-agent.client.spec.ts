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

test("generates creative plan with strict schema validation", async () => {
  const client = createCodexOcelotAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            return { finalResponse: JSON.stringify(buildValidCreativePlan()) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const creativePlan = await client.generateCreativePlan({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: buildRequest().storyBrief,
    photos: buildRequest().photos,
  });

  assert.equal(creativePlan.musicIntent.durationMs, 30000);
  assert.equal(creativePlan.visualDirection.pacing, "medium");
});

test("reviews creative assets and returns executable change instructions", async () => {
  const client = createCodexOcelotAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            return {
              finalResponse: JSON.stringify({
                passed: false,
                summary: "视觉和音乐在高潮处不同步",
                issues: [{ target: "cub", message: "鼓点提前进入高潮" }],
                requiredChanges: [
                  {
                    target: "cub",
                    instructions: ["将高潮鼓点延后到 18s", "前半段改为更轻的律动"],
                  },
                ],
              }),
            };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const review = await client.reviewCreativeAssets({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: buildRequest().storyBrief,
    creativePlan: buildValidCreativePlan(),
    visualScript: buildValidVisualScript(),
    midi: buildValidMidi(),
    round: 1,
    maxRounds: 3,
  });

  assert.equal(review.passed, false);
  assert.equal(review.requiredChanges[0]?.target, "cub");
  assert.ok(review.requiredChanges[0]?.instructions.length);
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

const buildValidCreativePlan = () => ({
  storyBriefRef: "/tmp/run/story-brief.json",
  narrativeArc: {
    opening: "温暖开场",
    development: "情绪推进",
    climax: "情绪抬升",
    resolution: "平静收束",
  },
  visualDirection: {
    style: "电影感",
    pacing: "medium" as const,
    transitionTone: "克制",
    subtitleStyle: "短句",
  },
  musicIntent: {
    moodKeywords: ["温暖", "怀旧"],
    bpmTrend: "arc" as const,
    keyMoments: [{ label: "climax", timeMs: 18000 }],
    instrumentationHints: ["钢琴", "弦乐"],
    durationMs: 30000,
  },
  alignmentPoints: [{ timeMs: 18000, visualCue: "近景", musicCue: "鼓点增强" }],
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

const buildValidMidi = () => ({
  bpm: 96,
  timeSignature: "4/4" as const,
  durationMs: 30000,
  tracks: [
    { name: "Piano" as const, channel: 0, program: 0, notes: [] },
    { name: "Strings" as const, channel: 1, program: 48, notes: [] },
    { name: "Bass" as const, channel: 2, program: 33, notes: [] },
    { name: "Drums" as const, channel: 9, program: 0, notes: [] },
  ],
});
