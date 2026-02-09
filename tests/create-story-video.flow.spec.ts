import test from "node:test";
import assert from "node:assert/strict";

import { createStoryVideoFlow } from "../src/flows/create-story-video/create-story-video.flow.ts";

test("flow asks input, style, prompt then enters render mode selection", async () => {
  const steps: string[] = [];
  const prompts = {
    askSourceDir: async () => {
      steps.push("askSourceDir");
      return "/tmp/photos";
    },
    askStylePreset: async () => {
      steps.push("askStylePreset");
      return "healing";
    },
    askPrompt: async () => {
      steps.push("askPrompt");
      return "a sunny afternoon";
    },
    chooseRenderMode: async () => {
      steps.push("chooseRenderMode");
      return "template" as const;
    },
  };

  const summary = await createStoryVideoFlow({
    prompts,
    storyAgentClient: {
      async generateStoryScript() {
        throw new Error("not used in this test");
      },
    },
    workflowImpl: async ({ chooseRenderMode }) => {
      await chooseRenderMode({});
      return {
        runId: "run-1",
        outputDir: "/tmp/photos/lihuacat-output/run-1",
        mode: "template",
        videoPath: "/tmp/photos/lihuacat-output/run-1/video.mp4",
        storyScriptPath: "/tmp/photos/lihuacat-output/run-1/story-script.json",
        runLogPath: "/tmp/photos/lihuacat-output/run-1/run.log",
      };
    },
  });

  assert.deepEqual(steps, [
    "askSourceDir",
    "askStylePreset",
    "askPrompt",
    "chooseRenderMode",
  ]);
  assert.equal(summary.mode, "template");
});
