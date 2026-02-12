import test from "node:test";
import assert from "node:assert/strict";

import { runRenderStoryCommand } from "../src/commands/render-story.command.ts";
import {
  type RunSummary,
  SourceDirectoryNotFoundError,
  StoryBriefGenerationFailedError,
} from "../src/pipeline.ts";
import type {
  RenderStoryTui,
  RenderStoryTuiIntroInput,
} from "../src/commands/tui/render-story.tui.ts";
import type { WorkflowProgressEvent } from "../src/workflow/workflow-events.ts";

type MockTuiState = {
  introInput?: RenderStoryTuiIntroInput;
  progressEvents: WorkflowProgressEvent[];
  failedLines: string[];
  completedSummary?: RunSummary;
};

test("prints key artifact paths on success", async () => {
  const { tui, state } = createMockTui();

  const exitCode = await runRenderStoryCommand({
    argv: [],
    tui,
    workflowImpl: async () => ({
      runId: "run-1",
      outputDir: "/tmp/photos/lihuacat-output/run-1",
      mode: "template",
      videoPath: "/tmp/photos/lihuacat-output/run-1/video.mp4",
      storyBriefPath: "/tmp/photos/lihuacat-output/run-1/story-brief.json",
      renderScriptPath: "/tmp/photos/lihuacat-output/run-1/render-script.json",
      tabbyConversationPath: "/tmp/photos/lihuacat-output/run-1/tabby-conversation.jsonl",
      runLogPath: "/tmp/photos/lihuacat-output/run-1/run.log",
      ocelotInputPath: "/tmp/photos/lihuacat-output/run-1/ocelot-input.json",
      ocelotOutputPath: "/tmp/photos/lihuacat-output/run-1/ocelot-output.json",
      ocelotPromptLogPath: "/tmp/photos/lihuacat-output/run-1/ocelot-prompt.log",
    }),
  });

  assert.equal(exitCode, 0);
  assert.equal(state.completedSummary?.videoPath, "/tmp/photos/lihuacat-output/run-1/video.mp4");
  assert.equal(
    state.completedSummary?.storyBriefPath,
    "/tmp/photos/lihuacat-output/run-1/story-brief.json",
  );
  assert.equal(state.completedSummary?.runLogPath, "/tmp/photos/lihuacat-output/run-1/run.log");
  assert.equal(state.failedLines.length, 0);
});

test("prints selected Codex model info", async () => {
  const { tui, state } = createMockTui();

  const exitCode = await runRenderStoryCommand({
    argv: [
      "--input",
      "/tmp/photos",
      "--model",
      "gpt-5.1-codex-mini",
      "--model-reasoning-effort",
      "medium",
    ],
    tui,
    workflowImpl: async () => ({
      runId: "run-model-info",
      outputDir: "/tmp/photos/lihuacat-output/run-model-info",
      mode: "template",
      videoPath: "/tmp/photos/lihuacat-output/run-model-info/video.mp4",
      storyBriefPath: "/tmp/photos/lihuacat-output/run-model-info/story-brief.json",
      renderScriptPath: "/tmp/photos/lihuacat-output/run-model-info/render-script.json",
      tabbyConversationPath: "/tmp/photos/lihuacat-output/run-model-info/tabby-conversation.jsonl",
      runLogPath: "/tmp/photos/lihuacat-output/run-model-info/run.log",
      ocelotInputPath: "/tmp/photos/lihuacat-output/run-model-info/ocelot-input.json",
      ocelotOutputPath: "/tmp/photos/lihuacat-output/run-model-info/ocelot-output.json",
      ocelotPromptLogPath: "/tmp/photos/lihuacat-output/run-model-info/ocelot-prompt.log",
    }),
  });

  assert.equal(exitCode, 0);
  assert.equal(state.introInput?.model, "gpt-5.1-codex-mini");
  assert.equal(state.introInput?.reasoningEffort, "medium");
});

test("accepts xhigh reasoning effort and prints it in model info", async () => {
  const { tui, state } = createMockTui();

  const exitCode = await runRenderStoryCommand({
    argv: [
      "--input",
      "/tmp/photos",
      "--model",
      "gpt-5.1-codex-mini",
      "--model-reasoning-effort",
      "xhigh",
    ],
    tui,
    workflowImpl: async () => ({
      runId: "run-model-xhigh",
      outputDir: "/tmp/photos/lihuacat-output/run-model-xhigh",
      mode: "template",
      videoPath: "/tmp/photos/lihuacat-output/run-model-xhigh/video.mp4",
      storyBriefPath: "/tmp/photos/lihuacat-output/run-model-xhigh/story-brief.json",
      renderScriptPath: "/tmp/photos/lihuacat-output/run-model-xhigh/render-script.json",
      tabbyConversationPath: "/tmp/photos/lihuacat-output/run-model-xhigh/tabby-conversation.jsonl",
      runLogPath: "/tmp/photos/lihuacat-output/run-model-xhigh/run.log",
      ocelotInputPath: "/tmp/photos/lihuacat-output/run-model-xhigh/ocelot-input.json",
      ocelotOutputPath: "/tmp/photos/lihuacat-output/run-model-xhigh/ocelot-output.json",
      ocelotPromptLogPath: "/tmp/photos/lihuacat-output/run-model-xhigh/ocelot-prompt.log",
    }),
  });

  assert.equal(exitCode, 0);
  assert.equal(state.introInput?.reasoningEffort, "xhigh");
});

test("prints readable failure reason", async () => {
  const { tui, state } = createMockTui();

  const exitCode = await runRenderStoryCommand({
    argv: [],
    tui,
    workflowImpl: async () => {
      throw new Error("template render failed: composition missing");
    },
  });

  assert.equal(exitCode, 1);
  assert.match(state.failedLines.join("\n"), /Run failed:/);
  assert.match(state.failedLines.join("\n"), /template render failed/);
});

test("prints generation failure details when story brief retries are exhausted", async () => {
  const { tui, state } = createMockTui();

  const exitCode = await runRenderStoryCommand({
    argv: [],
    tui,
    workflowImpl: async () => {
      throw new StoryBriefGenerationFailedError(3, [
        "attempt 1: missing codex auth",
        "attempt 2: model returned invalid JSON",
        "attempt 3: photos length mismatch",
      ]);
    },
  });

  assert.equal(exitCode, 1);
  assert.match(state.failedLines.join("\n"), /StoryBrief generation failure details:/);
  assert.match(state.failedLines.join("\n"), /attempt 1: missing codex auth/);
  assert.match(state.failedLines.join("\n"), /attempt 3: photos length mismatch/);
});

test("prints input tip when source directory path is invalid", async () => {
  const { tui, state } = createMockTui();

  const exitCode = await runRenderStoryCommand({
    argv: [],
    tui,
    workflowImpl: async () => {
      throw new SourceDirectoryNotFoundError("/tmp/a.jpg /tmp/b.jpg");
    },
  });

  assert.equal(exitCode, 1);
  assert.match(state.failedLines.join("\n"), /Expected one directory path/);
  assert.match(state.failedLines.join("\n"), /Input tip:/);
});

test("forwards workflow progress events to tui layer", async () => {
  const { tui, state } = createMockTui();

  const exitCode = await runRenderStoryCommand({
    argv: [],
    tui,
    workflowImpl: async ({ onProgress }) => {
      await onProgress?.({
        stage: "collect_images_start",
        message: "Collecting images from input directory...",
      });
      await onProgress?.({
        stage: "tabby_start",
        message: "Tabby is watching photos and chatting...",
      });
      return {
        runId: "run-2",
        outputDir: "/tmp/photos/lihuacat-output/run-2",
        mode: "template",
        videoPath: "/tmp/photos/lihuacat-output/run-2/video.mp4",
        storyBriefPath: "/tmp/photos/lihuacat-output/run-2/story-brief.json",
        renderScriptPath: "/tmp/photos/lihuacat-output/run-2/render-script.json",
        tabbyConversationPath: "/tmp/photos/lihuacat-output/run-2/tabby-conversation.jsonl",
        runLogPath: "/tmp/photos/lihuacat-output/run-2/run.log",
        ocelotInputPath: "/tmp/photos/lihuacat-output/run-2/ocelot-input.json",
        ocelotOutputPath: "/tmp/photos/lihuacat-output/run-2/ocelot-output.json",
        ocelotPromptLogPath: "/tmp/photos/lihuacat-output/run-2/ocelot-prompt.log",
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(state.progressEvents.length, 2);
  assert.equal(state.progressEvents[0]?.stage, "collect_images_start");
  assert.equal(state.progressEvents[1]?.stage, "tabby_start");
});

test("fails fast when terminal is not interactive", async () => {
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: [],
    stderr: err,
    isInteractiveTerminal: () => false,
  });

  assert.equal(exitCode, 1);
  assert.match(err.content(), /requires a TTY terminal/);
});

const createMockTui = (): {
  tui: RenderStoryTui;
  state: MockTuiState;
} => {
  const state: MockTuiState = {
    progressEvents: [],
    failedLines: [],
  };

  const tui: RenderStoryTui = {
    intro(input) {
      state.introInput = input;
    },
    async askSourceDir() {
      return "/tmp/photos";
    },
    async tabbyChooseOption() {
      throw new Error("not used in this test");
    },
    async tabbyAskFreeInput() {
      throw new Error("not used in this test");
    },
    onWorkflowProgress(event) {
      state.progressEvents.push(event);
    },
    complete(summary) {
      state.completedSummary = summary;
    },
    fail(lines) {
      state.failedLines = [...lines];
    },
    close() {
      // no-op for tests
    },
  };
  return { tui, state };
};

const createBufferWriter = () => {
  const chunks: string[] = [];
  return {
    write(chunk: string) {
      chunks.push(chunk);
    },
    content() {
      return chunks.join("");
    },
  };
};
