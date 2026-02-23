import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runStoryWorkflowV2 } from "../src/app/workflow/start-story-run.ts";

const compressImagesNoop = async ({
  images,
  outputDir,
  targetBytes,
}: {
  images: Array<{ index: number; fileName: string; absolutePath: string }>;
  outputDir: string;
  targetBytes?: number;
}) => ({
  publicDir: path.join(outputDir, "remotion-public"),
  stagedDir: path.join(outputDir, "remotion-public", "lihuacat-assets"),
  images: images.map((img) => ({
    index: img.index,
    fileName: img.fileName,
    absolutePath: img.absolutePath,
    extension: ".jpg" as const,
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
});

const createLegacyRenderScript = (photoRef = "1.jpg", subtitle = "hello") => ({
  storyBriefRef: "/tmp/run/story-brief.json",
  video: { width: 1080, height: 1920, fps: 30 },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef,
      subtitle,
      subtitlePosition: "bottom" as const,
      durationSec: 30,
      transition: { type: "cut" as const, durationMs: 0 },
    },
  ],
});

const createStoryBrief = (photoRefs: string[]) => ({
  intent: {
    coreEmotion: "释然",
    tone: "克制",
    narrativeArc: "起承转合",
    audienceNote: null,
    avoidance: [],
    rawUserWords: "很轻",
  },
  photos: photoRefs.map((photoRef, index) => ({
    photoRef,
    userSaid: "",
    emotionalWeight: 0.5,
    suggestedRole: index === 0 ? "开场" : "收尾",
    backstory: "",
    analysis: "",
  })),
  narrative: {
    arc: "起承转合",
    beats: [
      {
        photoRefs,
        moment: "moment",
        emotion: "emotion",
        duration: "short",
        transition: "cut",
      },
    ],
  },
});

test("workflow ends directly when template succeeds in first attempt", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    const summary = await runStoryWorkflowV2(
      {
        sourceDir,
        tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
        tabbyTui: {
          async chooseOption() { throw new Error("not used"); },
          async askFreeInput() { throw new Error("not used"); },
        },
        storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
        ocelotAgentClient: {
          async generateRenderScript({ debug }) {
            if (debug?.inputPath) await fs.writeFile(debug.inputPath, "{}", "utf8");
            if (debug?.outputPath) await fs.writeFile(debug.outputPath, "{}", "utf8");
            if (debug?.promptLogPath) await fs.writeFile(debug.promptLogPath, "prompt", "utf8");
            return createLegacyRenderScript();
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
        compressImagesImpl: compressImagesNoop,
        runTabbySessionImpl: async ({ conversationLogPath }) => {
          if (conversationLogPath) {
            await fs.appendFile(conversationLogPath, `{"type":"user"}\n`, "utf8");
          }
          return {
            conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
            confirmedSummary: "summary",
          };
        },
        generateStoryBriefImpl: async () => ({
          brief: createStoryBrief(["1.jpg"]),
          attempts: 1,
        }),
        renderByTemplateV2Impl: async ({ outputDir }) => {
          const videoPath = path.join(outputDir, "video.mp4");
          await fs.mkdir(outputDir, { recursive: true });
          await fs.writeFile(videoPath, "template-video");
          return { mode: "template", videoPath };
        },
        publishArtifactsImpl: async (input) => {
          await fs.mkdir(input.outputDir, { recursive: true });
          const runLogPath = path.join(input.outputDir, "run.log");
          await fs.writeFile(runLogPath, input.runLogs.join("\n"), "utf8");
          return {
            runId: input.runId,
            outputDir: input.outputDir,
            mode: "template",
            videoPath: input.videoPath,
            storyBriefPath: input.storyBriefPath,
            creativePlanPath: input.creativePlanPath,
            visualScriptPath: input.visualScriptPath,
            reviewLogPath: input.reviewLogPath,
            midiJsonPath: input.midiJsonPath,
            musicMidPath: input.musicMidPath,
            musicWavPath: input.musicWavPath,
            renderScriptPath: input.renderScriptPath,
            tabbyConversationPath: input.tabbyConversationPath,
            runLogPath,
            ocelotInputPath: input.ocelotInputPath,
            ocelotOutputPath: input.ocelotOutputPath,
            ocelotPromptLogPath: input.ocelotPromptLogPath,
            ocelotRevisionPaths: input.ocelotRevisionPaths,
          };
        },
      },
    );

    await assert.doesNotReject(fs.access(summary.videoPath));
    await assert.doesNotReject(fs.access(summary.storyBriefPath));
    await assert.doesNotReject(fs.access(summary.renderScriptPath));
    await assert.doesNotReject(fs.access(summary.tabbyConversationPath));
    await assert.doesNotReject(fs.access(summary.runLogPath));
    assert.equal(summary.ocelotRevisionPaths.length, 0);
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
        tabbyTui: {
          async chooseOption() { throw new Error("not used"); },
          async askFreeInput() { throw new Error("not used"); },
        },
        storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
        ocelotAgentClient: {
          async generateRenderScript({ debug }) {
            if (debug?.inputPath) await fs.writeFile(debug.inputPath, "{}", "utf8");
            if (debug?.outputPath) await fs.writeFile(debug.outputPath, "{}", "utf8");
            if (debug?.promptLogPath) await fs.writeFile(debug.promptLogPath, "prompt", "utf8");
            return createLegacyRenderScript();
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
        compressImagesImpl: compressImagesNoop,
        runTabbySessionImpl: async ({ conversationLogPath }) => {
          if (conversationLogPath) {
            await fs.appendFile(conversationLogPath, `{"type":"user"}\n`, "utf8");
          }
          return {
            conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
            confirmedSummary: "summary",
          };
        },
        generateStoryBriefImpl: async () => ({
          brief: createStoryBrief(["1.jpg"]),
          attempts: 1,
        }),
        renderByTemplateV2Impl: async ({ outputDir }) => {
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
          creativePlanPath: input.creativePlanPath,
          visualScriptPath: input.visualScriptPath,
          reviewLogPath: input.reviewLogPath,
          midiJsonPath: input.midiJsonPath,
          musicMidPath: input.musicMidPath,
          musicWavPath: input.musicWavPath,
          renderScriptPath: input.renderScriptPath,
          tabbyConversationPath: input.tabbyConversationPath,
          runLogPath: path.join(input.outputDir, "run.log"),
          ocelotInputPath: input.ocelotInputPath,
          ocelotOutputPath: input.ocelotOutputPath,
          ocelotPromptLogPath: input.ocelotPromptLogPath,
          ocelotRevisionPaths: input.ocelotRevisionPaths,
        }),
      },
    );

    assert.ok(events.includes("collect_images_start"));
    assert.ok(events.includes("collect_images_done"));
    assert.ok(events.includes("compress_images_start"));
    assert.ok(events.includes("compress_images_done"));
    assert.ok(events.includes("tabby_start"));
    assert.ok(events.includes("tabby_done"));
    assert.ok(events.includes("script_start"));
    assert.ok(events.includes("script_done"));
    assert.ok(events.includes("render_start"));
    assert.ok(events.includes("render_success"));
    assert.ok(events.includes("publish_done"));
  });
});

test("workflow publishes creative artifacts when kitten/cub path is enabled", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");
    await fs.writeFile(path.join(sourceDir, "2.jpg"), "fake-image");

    const summary = await runStoryWorkflowV2(
      {
        sourceDir,
        tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
        tabbyTui: {
          async chooseOption() { throw new Error("not used"); },
          async askFreeInput() { throw new Error("not used"); },
        },
        storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
        ocelotAgentClient: {
          async generateCreativePlan() {
            return {
              storyBriefRef: "/tmp/run/story-brief.json",
              narrativeArc: {
                opening: "warm",
                development: "lift",
                climax: "peak",
                resolution: "calm",
              },
              visualDirection: {
                style: "film",
                pacing: "medium" as const,
                transitionTone: "restrained",
                subtitleStyle: "short",
              },
              musicIntent: {
                moodKeywords: ["warm"],
                bpmTrend: "arc" as const,
                keyMoments: [{ label: "peak", timeMs: 15000 }],
                instrumentationHints: ["piano"],
                durationMs: 30000,
              },
              alignmentPoints: [],
            };
          },
          async reviewCreativeAssets() {
            return {
              passed: true,
              summary: "ok",
              issues: [],
              requiredChanges: [],
            };
          },
          async generateRenderScript() {
            throw new Error("legacy path not used");
          },
        },
        kittenAgentClient: {
          async generateVisualScript() {
            return {
              creativePlanRef: "/tmp/run/creative-plan.json",
              video: { width: 1080, height: 1920, fps: 30 },
              scenes: [
                {
                  sceneId: "scene_001",
                  photoRef: "1.jpg",
                  subtitle: "hello",
                  subtitlePosition: "bottom",
                  durationSec: 15,
                  transition: { type: "cut", durationMs: 0 },
                },
                {
                  sceneId: "scene_002",
                  photoRef: "2.jpg",
                  subtitle: "world",
                  subtitlePosition: "bottom",
                  durationSec: 15,
                  transition: { type: "cut", durationMs: 0 },
                },
              ],
            };
          },
        },
        cubAgentClient: {
          async generateMidiJson() {
            return {
              bpm: 96,
              timeSignature: "4/4",
              durationMs: 30000,
              tracks: [
                { name: "Piano", channel: 0, program: 0, notes: [] },
                { name: "Strings", channel: 1, program: 48, notes: [] },
                { name: "Bass", channel: 2, program: 33, notes: [] },
                { name: "Drums", channel: 9, program: 0, notes: [] },
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
            {
              index: 2,
              fileName: "2.jpg",
              absolutePath: path.join(sourceDir, "2.jpg"),
              extension: ".jpg",
            },
          ],
        }),
        compressImagesImpl: compressImagesNoop,
        runTabbySessionImpl: async ({ conversationLogPath }) => {
          if (conversationLogPath) {
            await fs.appendFile(conversationLogPath, `{"type":"user"}\n`, "utf8");
          }
          return {
            conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
            confirmedSummary: "summary",
          };
        },
        generateStoryBriefImpl: async () => ({
          brief: createStoryBrief(["1.jpg", "2.jpg"]),
          attempts: 1,
        }),
        renderByTemplateV2Impl: async ({ outputDir }) => {
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
          creativePlanPath: input.creativePlanPath,
          visualScriptPath: input.visualScriptPath,
          reviewLogPath: input.reviewLogPath,
          midiJsonPath: input.midiJsonPath,
          musicMidPath: input.musicMidPath,
          musicWavPath: input.musicWavPath,
          renderScriptPath: input.renderScriptPath,
          tabbyConversationPath: input.tabbyConversationPath,
          runLogPath: path.join(input.outputDir, "run.log"),
          ocelotInputPath: input.ocelotInputPath,
          ocelotOutputPath: input.ocelotOutputPath,
          ocelotPromptLogPath: input.ocelotPromptLogPath,
          ocelotRevisionPaths: input.ocelotRevisionPaths,
        }),
      },
    );

    await assert.doesNotReject(fs.access(summary.creativePlanPath!));
    await assert.doesNotReject(fs.access(summary.visualScriptPath!));
    await assert.doesNotReject(fs.access(summary.reviewLogPath!));
    await assert.doesNotReject(fs.access(summary.midiJsonPath!));
  });
});

test("workflow falls back to no-music render when cub generation fails", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    let reviewCalled = false;
    const summary = await runStoryWorkflowV2(
      {
        sourceDir,
        tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
        tabbyTui: {
          async chooseOption() { throw new Error("not used"); },
          async askFreeInput() { throw new Error("not used"); },
        },
        storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
        ocelotAgentClient: {
          async generateCreativePlan() {
            return {
              storyBriefRef: "/tmp/run/story-brief.json",
              narrativeArc: {
                opening: "warm",
                development: "lift",
                climax: "peak",
                resolution: "calm",
              },
              visualDirection: {
                style: "film",
                pacing: "medium" as const,
                transitionTone: "restrained",
                subtitleStyle: "short",
              },
              musicIntent: {
                moodKeywords: ["warm"],
                bpmTrend: "arc" as const,
                keyMoments: [{ label: "peak", timeMs: 15000 }],
                instrumentationHints: ["piano"],
                durationMs: 30000,
              },
              alignmentPoints: [],
            };
          },
          async reviewCreativeAssets() {
            reviewCalled = true;
            return {
              passed: true,
              summary: "ok",
              issues: [],
              requiredChanges: [],
            };
          },
          async generateRenderScript() {
            throw new Error("legacy path not used");
          },
        },
        kittenAgentClient: {
          async generateVisualScript() {
            return {
              creativePlanRef: "/tmp/run/creative-plan.json",
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
        cubAgentClient: {
          async generateMidiJson() {
            throw new Error("cub failed");
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
        compressImagesImpl: compressImagesNoop,
        runTabbySessionImpl: async ({ conversationLogPath }) => {
          if (conversationLogPath) {
            await fs.appendFile(conversationLogPath, `{"type":"user"}\n`, "utf8");
          }
          return {
            conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
            confirmedSummary: "summary",
          };
        },
        generateStoryBriefImpl: async () => ({
          brief: createStoryBrief(["1.jpg"]),
          attempts: 1,
        }),
        renderByTemplateV2Impl: async ({ outputDir, renderScript }) => {
          assert.equal(renderScript.audioTrack, undefined);
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
          creativePlanPath: input.creativePlanPath,
          visualScriptPath: input.visualScriptPath,
          reviewLogPath: input.reviewLogPath,
          midiJsonPath: input.midiJsonPath,
          musicMidPath: input.musicMidPath,
          musicWavPath: input.musicWavPath,
          renderScriptPath: input.renderScriptPath,
          tabbyConversationPath: input.tabbyConversationPath,
          runLogPath: path.join(input.outputDir, "run.log"),
          ocelotInputPath: input.ocelotInputPath,
          ocelotOutputPath: input.ocelotOutputPath,
          ocelotPromptLogPath: input.ocelotPromptLogPath,
          ocelotRevisionPaths: input.ocelotRevisionPaths,
        }),
      },
    );

    assert.equal(reviewCalled, false);
    const reviewLogRaw = await fs.readFile(summary.reviewLogPath!, "utf8");
    assert.match(reviewLogRaw, /Cub generation failed/);
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
          tabbyTui: {
            async chooseOption() { throw new Error("not used"); },
            async askFreeInput() { throw new Error("not used"); },
          },
          storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
          ocelotAgentClient: {
            async generateRenderScript({ debug }) {
              if (debug?.inputPath) await fs.writeFile(debug.inputPath, "{}", "utf8");
              if (debug?.outputPath) await fs.writeFile(debug.outputPath, "{}", "utf8");
              if (debug?.promptLogPath) await fs.writeFile(debug.promptLogPath, "prompt", "utf8");
              return createLegacyRenderScript();
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
          compressImagesImpl: compressImagesNoop,
          runTabbySessionImpl: async ({ conversationLogPath }) => {
            if (conversationLogPath) {
              await fs.appendFile(conversationLogPath, `{"type":"user"}\n`, "utf8");
            }
            return {
              conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
              confirmedSummary: "summary",
            };
          },
          generateStoryBriefImpl: async () => ({
            brief: createStoryBrief(["1.jpg"]),
            attempts: 1,
          }),
          renderByTemplateV2Impl: async () => {
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
    await assert.doesNotReject(fs.access(path.join(runDir, "stages", "compress-images.json")));
    await assert.doesNotReject(fs.access(path.join(runDir, "stages", "progress-events.jsonl")));

    const errorLog = await fs.readFile(path.join(runDir, "error.log"), "utf8");
    assert.match(errorLog, /template crash/);
  });
});

test("writes error.log when workflow fails before render stage", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    await assert.rejects(
      runStoryWorkflowV2(
        {
          sourceDir,
          tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
          tabbyTui: {
            async chooseOption() { throw new Error("not used"); },
            async askFreeInput() { throw new Error("not used"); },
          },
          storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
          ocelotAgentClient: { async generateRenderScript() { throw new Error("not used"); } },
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
          compressImagesImpl: compressImagesNoop,
          runTabbySessionImpl: async ({ conversationLogPath }) => {
            if (conversationLogPath) {
              await fs.appendFile(conversationLogPath, `{"type":"user"}\n`, "utf8");
            }
            return {
              conversation: [{ type: "user", time: "t", input: { kind: "option", id: "x", label: "x" } }],
              confirmedSummary: "summary",
            };
          },
          generateStoryBriefImpl: async () => {
            throw new Error("story brief crash");
          },
        },
      ),
      /story brief crash/,
    );

    const outputRoot = path.join(sourceDir, "lihuacat-output");
    const runDirs = (await fs.readdir(outputRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assert.equal(runDirs.length, 1);

    const runDir = path.join(outputRoot, runDirs[0]!);
    await assert.doesNotReject(fs.access(path.join(runDir, "run.log")));
    await assert.doesNotReject(fs.access(path.join(runDir, "error.log")));

    const errorLog = await fs.readFile(path.join(runDir, "error.log"), "utf8");
    assert.match(errorLog, /story brief crash/);
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
