import test from "node:test";
import assert from "node:assert/strict";

import {
  createCodexCubAgentClient,
  CubAgentResponseParseError,
  type GenerateCubMidiRequest,
} from "../src/subagents/cub/cub.client.ts";

test("calls Codex SDK with model override and returns validated midi json", async () => {
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

  const client = createCodexCubAgentClient({
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
            return { finalResponse: JSON.stringify(buildValidMidi(), null, 2) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const result = await client.generateMidiJson(buildRequest());
  assert.equal(result.durationMs, 30000);
  assert.equal(calls.threadOptions?.model, "gpt-5-codex");
  assert.equal(calls.threadOptions?.modelReasoningEffort, "high");
  assert.equal(calls.threadOptions?.workingDirectory, "/tmp/project");
  assert.equal(calls.threadOptions?.skipGitRepoCheck, true);
  assert.deepEqual((calls.runInput as Array<{ type: string }>).map((item) => item.type), ["text"]);
  assert.ok((calls.runOptions as { outputSchema?: unknown }).outputSchema);
});

test("throws parse error when SDK returns non-JSON content", async () => {
  const client = createCodexCubAgentClient({
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

  await assert.rejects(client.generateMidiJson(buildRequest()), CubAgentResponseParseError);
});

test("throws parse error when midi violates creative plan duration", async () => {
  const client = createCodexCubAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            const invalid = buildValidMidi();
            invalid.durationMs = 12000;
            return { finalResponse: JSON.stringify(invalid) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await assert.rejects(client.generateMidiJson(buildRequest()), /durationMs/i);
});

test("propagates auth failure before calling SDK", async () => {
  let called = false;
  const client = createCodexCubAgentClient({
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

  await assert.rejects(client.generateMidiJson(buildRequest()), /missing auth/);
  assert.equal(called, false);
});

const buildRequest = (): GenerateCubMidiRequest => ({
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
      moodKeywords: ["warm", "nostalgic"],
      bpmTrend: "arc",
      keyMoments: [{ label: "climax", timeMs: 18000 }],
      instrumentationHints: ["piano", "strings"],
      durationMs: 30000,
    },
    alignmentPoints: [{ timeMs: 18000, visualCue: "close-up", musicCue: "lift" }],
  },
});

const buildValidMidi = () => ({
  bpm: 98,
  timeSignature: "4/4" as const,
  durationMs: 30000,
  tracks: [
    {
      name: "Piano" as const,
      channel: 0,
      program: 0,
      notes: [{ pitch: 60, startMs: 0, durationMs: 500, velocity: 90 }],
    },
    {
      name: "Strings" as const,
      channel: 1,
      program: 48,
      notes: [{ pitch: 55, startMs: 0, durationMs: 1000, velocity: 72 }],
    },
    {
      name: "Bass" as const,
      channel: 2,
      program: 33,
      notes: [{ pitch: 36, startMs: 0, durationMs: 500, velocity: 92 }],
    },
    {
      name: "Drums" as const,
      channel: 9,
      program: 0,
      notes: [{ pitch: 36, startMs: 0, durationMs: 250, velocity: 96 }],
    },
  ],
});

