import test from "node:test";
import assert from "node:assert/strict";

import { createStoryVideoFlow } from "../src/flows/create-story-video/create-story-video.flow.ts";

test("flow asks input then runs workflow", async () => {
  const steps: string[] = [];
  const prompts = {
    askSourceDir: async () => {
      steps.push("askSourceDir");
      return "/tmp/photos";
    },
  };

  const summary = await createStoryVideoFlow({
    prompts,
    tabbyAgentClient: {
      async generateTurn() {
        throw new Error("not used in this test");
      },
    },
    tabbyTui: {
      async chooseOption() {
        throw new Error("not used in this test");
      },
      async askFreeInput() {
        throw new Error("not used in this test");
      },
    },
    storyBriefAgentClient: {
      async generateStoryBrief() {
        throw new Error("not used in this test");
      },
    },
    ocelotAgentClient: {
      async generateRenderScript() {
        throw new Error("not used in this test");
      },
    },
    workflowImpl: async () => {
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

  assert.deepEqual(steps, ["askSourceDir"]);
  assert.equal(summary.mode, "template");
});
