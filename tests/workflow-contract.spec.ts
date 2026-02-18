import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runStoryWorkflowV2 } from "../src/workflow/start-story-run.ts";

test("workflow contract: emits ordered core stage events on first-pass template success", async () => {
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
        lynxAgentClient: {
          async reviewRenderScript() {
            throw new Error("lynx should not be called when lynx-review is disabled");
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
        compressImagesImpl: async ({ images, outputDir, targetBytes }) => ({
          publicDir: path.join(outputDir, "remotion-public"),
          stagedDir: path.join(outputDir, "remotion-public", "lihuacat-assets"),
          images: images.map((img) => ({
            index: img.index,
            fileName: img.fileName,
            absolutePath: img.absolutePath,
            extension: ".jpg",
          })),
          report: images.map((img) => ({
            index: img.index,
            fileName: img.fileName,
            originalAbsolutePath: img.absolutePath,
            stagedAbsolutePath: img.absolutePath,
            originalBytes: 0,
            stagedBytes: 0,
            targetBytes: targetBytes ?? 0,
            quality: 82,
            scale: 1,
          })),
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
        renderByTemplateV2Impl: async ({ outputDir }) => {
          const videoPath = path.join(outputDir, "video.mp4");
          await fs.mkdir(outputDir, { recursive: true });
          await fs.writeFile(videoPath, "video");
          return {
            mode: "template",
            videoPath,
          };
        },
        publishArtifactsImpl: async (input) => ({
          runId: input.runId,
          outputDir: input.outputDir,
          mode: "template",
          videoPath: input.videoPath,
          storyBriefPath: input.storyBriefPath,
          renderScriptPath: input.renderScriptPath,
          tabbyConversationPath: input.tabbyConversationPath,
          runLogPath: path.join(input.outputDir, "run.log"),
          ocelotInputPath: input.ocelotInputPath,
          ocelotOutputPath: input.ocelotOutputPath,
          ocelotPromptLogPath: input.ocelotPromptLogPath,
          lynxReviewPaths: input.lynxReviewPaths,
          lynxPromptLogPaths: input.lynxPromptLogPaths,
          ocelotRevisionPaths: input.ocelotRevisionPaths,
        }),
      },
    );

    assert.deepEqual(stages, [
      "collect_images_start",
      "collect_images_done",
      "compress_images_start",
      "compress_images_done",
      "tabby_start",
      "tabby_done",
      "script_start",
      "script_done",
      "render_start",
      "render_success",
      "publish_start",
      "publish_done",
    ]);
    assert.equal(summary.mode, "template");
    assert.match(summary.videoPath, /video\.mp4$/);
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
