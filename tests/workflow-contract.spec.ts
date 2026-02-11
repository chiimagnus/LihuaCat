import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runStoryWorkflow, runStoryWorkflowV2 } from "../src/workflow/start-story-run.ts";
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

test("workflow v2 contract: emits ordered core stage events on first-pass template success", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    const stages: string[] = [];

    const summary = await runStoryWorkflowV2(
      {
        sourceDir,
        tabbyAgentClient: {
          async generateTurn() {
            throw new Error("not used");
          },
        },
        tabbyTui: {
          async chooseOption() {
            throw new Error("not used");
          },
          async askFreeInput() {
            throw new Error("not used");
          },
        },
        storyBriefAgentClient: {
          async generateStoryBrief() {
            throw new Error("not used");
          },
        },
        ocelotAgentClient: {
          async generateRenderScript() {
            return {
              storyBriefRef: "/tmp/run/story-brief.json",
              video: { width: 1080, height: 1920, fps: 30 },
              scenes: [
                {
                  sceneId: "scene_001",
                  photoRef: "1.jpg",
                  subtitle: "hello",
                  subtitlePosition: "bottom",
                  durationSec: 30,
                  transition: { type: "cut", durationMs: 0 },
                },
              ],
            };
          },
        },
        onProgress: (event) => {
          stages.push(event.stage);
        },
      },
      {
        collectImagesImpl: async () => ({
          sourceDir,
          images: [
            {
              index: 1,
              fileName: "1.jpg",
              absolutePath: path.join(sourceDir, "1.jpg"),
              extension: ".jpg",
            },
          ],
        }),
        runTabbySessionImpl: async () => ({
          conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
          confirmedSummary: "summary",
        }),
        generateStoryBriefImpl: async () => ({
          brief: {
            intent: {
              coreEmotion: "释然",
              tone: "克制",
              narrativeArc: "起承转合",
              audienceNote: null,
              avoidance: [],
              rawUserWords: "很轻",
            },
            photos: [
              {
                photoRef: "1.jpg",
                userSaid: "",
                emotionalWeight: 0.5,
                suggestedRole: "开场",
                backstory: "",
                analysis: "",
              },
            ],
            narrative: {
              arc: "起承转合",
              beats: [
                {
                  photoRefs: ["1.jpg"],
                  moment: "moment",
                  emotion: "emotion",
                  duration: "short",
                  transition: "cut",
                },
              ],
            },
          },
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
        publishArtifactsImpl: async () => ({
          runId: "run-v2",
          outputDir: path.join(sourceDir, "lihuacat-output", "run-v2"),
          mode: "template",
          videoPath: path.join(sourceDir, "lihuacat-output", "run-v2", "video.mp4"),
          storyScriptPath: path.join(sourceDir, "lihuacat-output", "run-v2", "story-script.json"),
          runLogPath: path.join(sourceDir, "lihuacat-output", "run-v2", "run.log"),
        }),
      },
    );

    assert.deepEqual(stages, [
      "collect_images_start",
      "collect_images_done",
      "tabby_start",
      "tabby_done",
      "ocelot_start",
      "ocelot_done",
      "render_start",
      "render_success",
      "publish_start",
      "publish_done",
    ]);
    assert.equal(summary.mode, "template");
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
