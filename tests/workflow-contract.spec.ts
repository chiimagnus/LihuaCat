import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runStoryWorkflow } from "../src/workflow/start-story-run.ts";
import type { StoryScript } from "../src/contracts/story-script.types.ts";

test("workflow contract: emits ordered core stage events on first-pass template success", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    const storyScript = buildStoryScript(sourceDir);
    const stages: string[] = [];

    const summary = await runStoryWorkflow(
      {
        sourceDir,
        storyAgentClient: {
          async generateStoryScript() {
            throw new Error("not used");
          },
        },
        style: { preset: "healing" },
        chooseRenderMode: async () => "template",
        onProgress: (event) => {
          stages.push(event.stage);
        },
      },
      {
        generateStoryScriptImpl: async () => ({
          script: storyScript,
          attempts: 1,
        }),
        renderByTemplateImpl: async ({ outputDir }) => {
          const videoPath = path.join(outputDir, "video.mp4");
          await fs.mkdir(outputDir, { recursive: true });
          await fs.writeFile(videoPath, "video");
          return {
            mode: "template",
            videoPath,
          };
        },
      },
    );

    assert.deepEqual(stages, [
      "collect_images_start",
      "collect_images_done",
      "generate_script_start",
      "generate_script_done",
      "choose_mode",
      "render_start",
      "render_success",
      "publish_start",
      "publish_done",
    ]);
    assert.equal(summary.mode, "template");
    assert.match(summary.videoPath, /video\.mp4$/);
  });
});

test("workflow contract: re-enters mode selection after AI code failure", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    const storyScript = buildStoryScript(sourceDir);
    const modeQueue: Array<"ai_code" | "template"> = ["ai_code", "template"];
    const failures: string[] = [];
    const stages: string[] = [];

    const summary = await runStoryWorkflow(
      {
        sourceDir,
        storyAgentClient: {
          async generateStoryScript() {
            throw new Error("not used");
          },
        },
        style: { preset: "healing" },
        chooseRenderMode: async () => modeQueue.shift() ?? "template",
        onRenderFailure: ({ reason }) => {
          failures.push(reason);
        },
        onProgress: (event) => {
          stages.push(event.stage);
        },
      },
      {
        generateStoryScriptImpl: async () => ({
          script: storyScript,
          attempts: 1,
        }),
        renderByAiCodeImpl: async ({ outputDir }) => ({
          ok: false,
          generatedCodeDir: path.join(outputDir, "generated-remotion"),
          error: {
            stage: "compile",
            message: "syntactic error",
            details: "line 8",
          },
        }),
        renderByTemplateImpl: async ({ outputDir }) => {
          const videoPath = path.join(outputDir, "video.mp4");
          await fs.mkdir(outputDir, { recursive: true });
          await fs.writeFile(videoPath, "video");
          return {
            mode: "template",
            videoPath,
          };
        },
      },
    );

    assert.equal(summary.mode, "template");
    assert.equal(failures[0], "compile: syntactic error | line 8");
    assert.equal(stages.filter((stage) => stage === "choose_mode").length, 2);
    assert.equal(stages.filter((stage) => stage === "render_failed").length, 1);
  });
});

test("workflow contract: exits with error after failed render when chooser returns exit", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    const storyScript = buildStoryScript(sourceDir);
    const modeQueue: Array<"template" | "exit"> = ["template", "exit"];

    await assert.rejects(
      runStoryWorkflow(
        {
          sourceDir,
          storyAgentClient: {
            async generateStoryScript() {
              throw new Error("not used");
            },
          },
          style: { preset: "healing" },
          chooseRenderMode: async () => modeQueue.shift() ?? "exit",
        },
        {
          generateStoryScriptImpl: async () => ({
            script: storyScript,
            attempts: 1,
          }),
          renderByTemplateImpl: async () => {
            throw new Error("template crash");
          },
        },
      ),
      /Run exited after render failure/,
    );
  });
});

const withTempDir = async (run: (sourceDir: string) => Promise<void>) => {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-contract-"));
  try {
    await run(sourceDir);
  } finally {
    await fs.rm(sourceDir, { recursive: true, force: true });
  }
};

const buildStoryScript = (sourceDir: string): StoryScript => ({
  version: "1.0",
  input: {
    sourceDir,
    imageCount: 1,
    assets: [{ id: "img_001", path: path.join(sourceDir, "1.jpg") }],
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationSec: 30,
  },
  style: { preset: "healing" },
  timeline: [{ assetId: "img_001", startSec: 0, endSec: 30, subtitleId: "sub_1" }],
  subtitles: [{ id: "sub_1", text: "hello", startSec: 0, endSec: 30 }],
});
