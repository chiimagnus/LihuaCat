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
  let receivedEnableLynxReview: boolean | undefined = undefined;

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
    lynxAgentClient: {
      async reviewRenderScript() {
        throw new Error("not used in this test");
      },
    },
    enableLynxReview: true,
    workflowImpl: async (input) => {
      receivedEnableLynxReview = input.enableLynxReview;
      return {
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
        lynxReviewPaths: [],
        lynxPromptLogPaths: [],
        ocelotRevisionPaths: [],
      };
    },
  });

  assert.deepEqual(steps, ["askSourceDir"]);
  assert.equal(summary.mode, "template");
  assert.equal(receivedEnableLynxReview, true);
});
