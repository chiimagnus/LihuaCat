import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runStoryWorkflow } from "./start-story-run.ts";
import type { StoryScript } from "../contracts/story-script.types.ts";

test("workflow loops back to selection after AI code failure and ends on template success", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    const modeQueue: Array<"ai_code" | "template"> = ["ai_code", "template"];
    const failures: string[] = [];
    const storyScript = buildStoryScript(sourceDir);

    const summary = await runStoryWorkflow(
      {
        sourceDir,
        storyAgentClient: {
          async generateStoryScript() {
            throw new Error("should not be called in this test");
          },
        },
        style: { preset: "healing" },
        chooseRenderMode: async () => {
          const mode = modeQueue.shift();
          if (!mode) {
            return "exit";
          }
          return mode;
        },
        onRenderFailure: ({ reason }) => {
          failures.push(reason);
        },
      },
      {
        generateStoryScriptImpl: async () => ({ script: storyScript, attempts: 1 }),
        renderByAiCodeImpl: async () => ({
          ok: false,
          generatedCodeDir: path.join(sourceDir, "lihuacat-output", "generated-remotion"),
          error: {
            stage: "compile",
            message: "syntactic error",
            details: "line 8",
          },
        }),
        renderByTemplateImpl: async ({ outputDir }) => {
          const videoPath = path.join(outputDir, "video.mp4");
          await fs.mkdir(outputDir, { recursive: true });
          await fs.writeFile(videoPath, "template-video");
          return { mode: "template", videoPath };
        },
      },
    );

    assert.equal(summary.mode, "template");
    assert.ok(failures.length >= 1);
    await assert.doesNotReject(fs.access(summary.videoPath));
    await assert.doesNotReject(fs.access(summary.storyScriptPath));
    await assert.doesNotReject(fs.access(summary.runLogPath));
  });
});

test("workflow ends directly when template succeeds in first attempt", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    const storyScript = buildStoryScript(sourceDir);

    const summary = await runStoryWorkflow(
      {
        sourceDir,
        storyAgentClient: {
          async generateStoryScript() {
            throw new Error("should not be called in this test");
          },
        },
        style: { preset: "healing" },
        chooseRenderMode: async () => "template",
      },
      {
        generateStoryScriptImpl: async () => ({ script: storyScript, attempts: 1 }),
        renderByTemplateImpl: async ({ outputDir }) => {
          const videoPath = path.join(outputDir, "video.mp4");
          await fs.mkdir(outputDir, { recursive: true });
          await fs.writeFile(videoPath, "template-video");
          return { mode: "template", videoPath };
        },
      },
    );

    assert.equal(summary.mode, "template");
  });
});

test("workflow ends directly when AI code render succeeds", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    const storyScript = buildStoryScript(sourceDir);

    const summary = await runStoryWorkflow(
      {
        sourceDir,
        storyAgentClient: {
          async generateStoryScript() {
            throw new Error("should not be called in this test");
          },
        },
        style: { preset: "healing" },
        chooseRenderMode: async () => "ai_code",
      },
      {
        generateStoryScriptImpl: async () => ({ script: storyScript, attempts: 1 }),
        renderByAiCodeImpl: async ({ outputDir }) => {
          const videoPath = path.join(outputDir, "video.mp4");
          const generatedCodeDir = path.join(outputDir, "generated-remotion");
          await fs.mkdir(generatedCodeDir, { recursive: true });
          await fs.writeFile(videoPath, "ai-video");
          return {
            ok: true,
            mode: "ai_code",
            videoPath,
            generatedCodeDir,
          };
        },
      },
    );

    assert.equal(summary.mode, "ai_code");
    assert.ok(summary.generatedCodePath?.endsWith("generated-remotion"));
  });
});

const withTempDir = async (run: (sourceDir: string) => Promise<void>) => {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-workflow-"));
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
