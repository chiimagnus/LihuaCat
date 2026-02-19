import test from "node:test";
import assert from "node:assert/strict";

import {
  createCodexTabbyAgentClient,
  TabbyAgentResponseParseError,
  type GenerateTabbyTurnRequest,
} from "../src/agents/tabby/tabby.client.ts";

test("calls Codex SDK with model override and validates JSON result", async () => {
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

  const client = createCodexTabbyAgentClient({
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
            return {
              finalResponse: JSON.stringify(buildValidTurn(), null, 2),
            };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  const result = await client.generateTurn(buildRequest());
  assert.equal(result.done, false);
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

test("attaches images only on the first turn", async () => {
  const runInputs: unknown[] = [];

  const client = createCodexTabbyAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run(input) {
            runInputs.push(input);
            return { finalResponse: JSON.stringify(buildValidTurn()) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await client.generateTurn(buildRequest({ turn: 1 }));
  await client.generateTurn(buildRequest({ turn: 2 }));

  assert.deepEqual(
    (runInputs[0] as Array<{ type: string }>).map((item) => item.type),
    ["text", "local_image", "local_image"],
  );
  assert.deepEqual(
    (runInputs[1] as Array<{ type: string }>).map((item) => item.type),
    ["text"],
  );
});

test("uses project defaults when no model options are provided", async () => {
  const calls: { threadOptions?: { model?: string; modelReasoningEffort?: string } } = {};

  const client = createCodexTabbyAgentClient({
    codexFactory: () => ({
      startThread(options) {
        calls.threadOptions = options;
        return {
          async run() {
            return { finalResponse: JSON.stringify(buildValidTurn()) };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await client.generateTurn(buildRequest());
  assert.equal(calls.threadOptions?.model, "gpt-5.1-codex-mini");
  assert.equal(calls.threadOptions?.modelReasoningEffort, "medium");
});

test("throws parse error when SDK returns non-JSON content", async () => {
  const client = createCodexTabbyAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            return { finalResponse: "This is not JSON" };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await assert.rejects(client.generateTurn(buildRequest()), TabbyAgentResponseParseError);
});

test("throws parse error when JSON violates turn constraints", async () => {
  const client = createCodexTabbyAgentClient({
    codexFactory: () => ({
      startThread() {
        return {
          async run() {
            return {
              finalResponse: JSON.stringify({ say: "x", done: true, options: [] }),
            };
          },
        };
      },
    }),
    assertAuthenticated: async () => {
      return;
    },
  });

  await assert.rejects(client.generateTurn(buildRequest()), /failed validation/i);
});

test("propagates auth failure before calling SDK", async () => {
  let called = false;
  const client = createCodexTabbyAgentClient({
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

  await assert.rejects(client.generateTurn(buildRequest()), /missing auth/);
  assert.equal(called, false);
});

const buildRequest = (overrides: Partial<GenerateTabbyTurnRequest> = {}): GenerateTabbyTurnRequest => ({
  photos: [
    { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
    { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
  ],
  conversation: [],
  phase: "start",
  turn: 1,
  ...overrides,
});

const buildValidTurn = () => ({
  say: "看到这组照片，你最想留下的感觉是什么？",
  done: false,
  options: [
    { id: "warm", label: "温柔、克制" },
    { id: "relief", label: "一种释然" },
    { id: "free_input", label: "我想自己说…" },
  ],
  internalNotes: "Start by eliciting core emotion.",
});
