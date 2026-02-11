import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runStoryWorkflowV2 } from "../src/workflow/start-story-run.ts";

test("workflow ends directly when template succeeds in first attempt", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

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
          async generateRenderScript({ debug }) {
            if (debug?.inputPath) await fs.writeFile(debug.inputPath, "{}", "utf8");
            if (debug?.outputPath) await fs.writeFile(debug.outputPath, "{}", "utf8");
            if (debug?.promptLogPath) await fs.writeFile(debug.promptLogPath, "prompt", "utf8");
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
        runTabbySessionImpl: async ({ conversationLogPath }) => {
          if (conversationLogPath) {
            await fs.appendFile(conversationLogPath, `{\"type\":\"user\"}\n`, "utf8");
          }
          return {
            conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
            confirmedSummary: "summary",
          };
        },
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
          await fs.writeFile(videoPath, "template-video");
          return { mode: "template", videoPath };
        },
        publishArtifactsImpl: async (input) => {
          await fs.mkdir(input.outputDir, { recursive: true });
          await fs.writeFile(path.join(input.outputDir, "run.log"), input.runLogs.join("\n"), "utf8");
          return {
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
          };
        },
      },
    );

    await assert.doesNotReject(fs.access(summary.videoPath));
    await assert.doesNotReject(fs.access(summary.storyBriefPath));
    await assert.doesNotReject(fs.access(summary.renderScriptPath));
    await assert.doesNotReject(fs.access(summary.tabbyConversationPath));
    await assert.doesNotReject(fs.access(summary.runLogPath));
  });
});

test("workflow emits progress events across core stages", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    const events: string[] = [];

    await runStoryWorkflowV2(
      {
        sourceDir,
        tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
        tabbyTui: { async chooseOption() { throw new Error("not used"); }, async askFreeInput() { throw new Error("not used"); } },
        storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
        ocelotAgentClient: {
          async generateRenderScript({ debug }) {
            if (debug?.inputPath) await fs.writeFile(debug.inputPath, "{}", "utf8");
            if (debug?.outputPath) await fs.writeFile(debug.outputPath, "{}", "utf8");
            if (debug?.promptLogPath) await fs.writeFile(debug.promptLogPath, "prompt", "utf8");
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
          events.push(event.stage);
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
        runTabbySessionImpl: async ({ conversationLogPath }) => {
          if (conversationLogPath) {
            await fs.appendFile(conversationLogPath, `{\"type\":\"user\"}\n`, "utf8");
          }
          return {
            conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
            confirmedSummary: "summary",
          };
        },
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
          await fs.writeFile(videoPath, "template-video");
          return { mode: "template", videoPath };
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
        }),
      },
    );

    assert.ok(events.includes("collect_images_start"));
    assert.ok(events.includes("collect_images_done"));
    assert.ok(events.includes("tabby_start"));
    assert.ok(events.includes("tabby_done"));
    assert.ok(events.includes("ocelot_start"));
    assert.ok(events.includes("ocelot_done"));
    assert.ok(events.includes("render_start"));
    assert.ok(events.includes("render_success"));
    assert.ok(events.includes("publish_done"));
  });
});

test("persists stage artifacts even when run exits after render failure", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    await assert.rejects(
      runStoryWorkflowV2(
        {
          sourceDir,
          tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
          tabbyTui: { async chooseOption() { throw new Error("not used"); }, async askFreeInput() { throw new Error("not used"); } },
          storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
          ocelotAgentClient: {
            async generateRenderScript({ debug }) {
              if (debug?.inputPath) await fs.writeFile(debug.inputPath, "{}", "utf8");
              if (debug?.outputPath) await fs.writeFile(debug.outputPath, "{}", "utf8");
              if (debug?.promptLogPath) await fs.writeFile(debug.promptLogPath, "prompt", "utf8");
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
          runTabbySessionImpl: async ({ conversationLogPath }) => {
            if (conversationLogPath) {
              await fs.appendFile(conversationLogPath, `{\"type\":\"user\"}\n`, "utf8");
            }
            return {
              conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
              confirmedSummary: "summary",
            };
          },
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
          renderByTemplateImpl: async () => {
            throw new Error("template crash");
          },
        },
      ),
      /template crash/,
    );

    const outputRoot = path.join(sourceDir, "lihuacat-output");
    const runDirs = (await fs.readdir(outputRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assert.equal(runDirs.length, 1);

    const runDir = path.join(outputRoot, runDirs[0]!);
    await assert.doesNotReject(fs.access(path.join(runDir, "story-brief.json")));
    await assert.doesNotReject(fs.access(path.join(runDir, "render-script.json")));
    await assert.doesNotReject(fs.access(path.join(runDir, "tabby-conversation.jsonl")));
    await assert.doesNotReject(fs.access(path.join(runDir, "run.log")));
    await assert.doesNotReject(fs.access(path.join(runDir, "error.log")));
    await assert.doesNotReject(fs.access(path.join(runDir, "stages", "material-intake.json")));
    await assert.doesNotReject(fs.access(path.join(runDir, "stages", "progress-events.jsonl")));

    const errorLog = await fs.readFile(path.join(runDir, "error.log"), "utf8");
    assert.match(errorLog, /template crash/);
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
