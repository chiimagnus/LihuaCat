import test from "node:test";
import assert from "node:assert/strict";

import {
  createCodexStoryBriefAgentClient,
  StoryBriefAgentResponseParseError,
  type GenerateStoryBriefRequest,
} from "../src/subagents/story-brief/story-brief.client.ts";

test("calls Codex SDK with model override and parses JSON result", async () => {
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

  const client = createCodexStoryBriefAgentClient({
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
            return { finalResponse: JSON.stringify(buildValidBrief(), null, 2) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const result = await client.generateStoryBrief(buildRequest());
  assert.equal((result as { intent: { coreEmotion: string } }).intent.coreEmotion, "释然");
  assert.equal(calls.threadOptions?.model, "gpt-5-codex");
  assert.equal(calls.threadOptions?.modelReasoningEffort, "high");
  assert.equal(calls.threadOptions?.workingDirectory, "/tmp/project");
  assert.equal(calls.threadOptions?.skipGitRepoCheck, true);
  assert.deepEqual(
    (calls.runInput as Array<{ type: string }>).map((item) => item.type),
    ["text", "local_image"],
  );
  assert.ok((calls.runOptions as { outputSchema?: unknown }).outputSchema);
});

test("throws parse error when SDK returns non-JSON content", async () => {
  const client = createCodexStoryBriefAgentClient({
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

  await assert.rejects(client.generateStoryBrief(buildRequest()), StoryBriefAgentResponseParseError);
});

test("propagates auth failure before calling SDK", async () => {
  let called = false;
  const client = createCodexStoryBriefAgentClient({
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

  await assert.rejects(client.generateStoryBrief(buildRequest()), /missing auth/);
  assert.equal(called, false);
});

const buildRequest = (): GenerateStoryBriefRequest => ({
  photos: [{ photoRef: "1.jpg", path: "/tmp/1.jpg" }],
  conversation: [],
  confirmedSummary: "summary",
  attempt: 1,
  previousErrors: [],
});

const buildValidBrief = () => ({
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
  ],
  narrative: {
    arc: "起→承→转→合",
    beats: [
      {
        photoRefs: ["1.jpg"],
        moment: "一个瞬间",
        emotion: "温柔",
        duration: "short",
        transition: "渐入",
      },
    ],
  },
});
