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
        lynxAgentClient: {
          async reviewRenderScript({ debug }) {
            if (debug?.promptLogPath) {
              await fs.writeFile(debug.promptLogPath, "lynx prompt", "utf8");
            }
            return { passed: true, issues: [], requiredChanges: [] };
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
        renderByTemplateV2Impl: async ({ outputDir }) => {
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
            lynxReviewPaths: input.lynxReviewPaths,
            lynxPromptLogPaths: input.lynxPromptLogPaths,
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
    assert.equal(summary.lynxReviewPaths.length, 0);
    assert.equal(summary.lynxPromptLogPaths.length, 0);
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
        lynxAgentClient: {
          async reviewRenderScript({ debug }) {
            if (debug?.promptLogPath) {
              await fs.writeFile(debug.promptLogPath, "lynx prompt", "utf8");
            }
            return { passed: true, issues: [], requiredChanges: [] };
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
          lynxAgentClient: {
            async reviewRenderScript({ debug }) {
              if (debug?.promptLogPath) {
                await fs.writeFile(debug.promptLogPath, "lynx prompt", "utf8");
              }
              return { passed: true, issues: [], requiredChanges: [] };
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
          tabbyTui: { async chooseOption() { throw new Error("not used"); }, async askFreeInput() { throw new Error("not used"); } },
          storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
          ocelotAgentClient: { async generateRenderScript() { throw new Error("not used"); } },
          lynxAgentClient: { async reviewRenderScript() { throw new Error("not used"); } },
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
              await fs.appendFile(conversationLogPath, `{\"type\":\"user\"}\n`, "utf8");
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

test("lynx review loop converges in second round and persists artifacts", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    let ocelotCall = 0;
    const summary = await runStoryWorkflowV2(
      {
        sourceDir,
        enableLynxReview: true,
        tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
        tabbyTui: { async chooseOption() { throw new Error("not used"); }, async askFreeInput() { throw new Error("not used"); } },
        storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
        ocelotAgentClient: {
          async generateRenderScript({ revisionNotes, debug }) {
            ocelotCall += 1;
            if (debug?.inputPath) await fs.writeFile(debug.inputPath, "{}", "utf8");
            if (debug?.outputPath) await fs.writeFile(debug.outputPath, "{}", "utf8");
            if (debug?.promptLogPath) await fs.writeFile(debug.promptLogPath, "prompt", "utf8");
            const subtitle = revisionNotes && revisionNotes.length > 0 ? "v2-fixed" : "v1-bad";
            return {
              storyBriefRef: "/tmp/run/story-brief.json",
              video: { width: 1080, height: 1920, fps: 30 },
              scenes: [
                {
                  sceneId: "scene_001",
                  photoRef: "1.jpg",
                  subtitle,
                  subtitlePosition: "bottom",
                  durationSec: 30,
                  transition: { type: "cut", durationMs: 0 },
                },
              ],
            };
          },
        },
        lynxAgentClient: {
          async reviewRenderScript({ round, debug }) {
            if (debug?.promptLogPath) {
              await fs.writeFile(debug.promptLogPath, `lynx prompt ${round}`, "utf8");
            }
            if (round === 1) {
              return {
                passed: false,
                issues: [{ category: "avoidance_conflict", message: "forbidden phrase" }],
                requiredChanges: ["Remove forbidden phrase", "Use restrained tone"],
              };
            }
            return { passed: true, issues: [], requiredChanges: [] };
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
              avoidance: ["不要岁月静好"],
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
        renderByTemplateV2Impl: async ({ outputDir, renderScript }) => {
          assert.equal(renderScript.scenes[0]?.subtitle, "v2-fixed");
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
            lynxReviewPaths: input.lynxReviewPaths,
            lynxPromptLogPaths: input.lynxPromptLogPaths,
            ocelotRevisionPaths: input.ocelotRevisionPaths,
          };
        },
      },
    );

    assert.equal(ocelotCall, 2);
    assert.equal(summary.ocelotRevisionPaths.length, 2);
    assert.equal(summary.lynxReviewPaths.length, 2);
    assert.equal(summary.lynxPromptLogPaths.length, 2);
    await assert.doesNotReject(fs.access(summary.ocelotRevisionPaths[0]!));
    await assert.doesNotReject(fs.access(summary.ocelotRevisionPaths[1]!));
    await assert.doesNotReject(fs.access(summary.lynxReviewPaths[0]!));
    await assert.doesNotReject(fs.access(summary.lynxReviewPaths[1]!));
    await assert.doesNotReject(fs.access(summary.lynxPromptLogPaths[0]!));
    await assert.doesNotReject(fs.access(summary.lynxPromptLogPaths[1]!));
  });
});

test("lynx review loop reaches max rounds and still renders last version", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    let ocelotRound = 0;
    const summary = await runStoryWorkflowV2(
      {
        sourceDir,
        enableLynxReview: true,
        tabbyAgentClient: { async generateTurn() { throw new Error("not used"); } },
        tabbyTui: { async chooseOption() { throw new Error("not used"); }, async askFreeInput() { throw new Error("not used"); } },
        storyBriefAgentClient: { async generateStoryBrief() { throw new Error("not used"); } },
        ocelotAgentClient: {
          async generateRenderScript({ debug }) {
            ocelotRound += 1;
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
                  subtitle: `round${ocelotRound}`,
                  subtitlePosition: "bottom",
                  durationSec: 30,
                  transition: { type: "cut", durationMs: 0 },
                },
              ],
            };
          },
        },
        lynxAgentClient: {
          async reviewRenderScript({ round, debug }) {
            if (debug?.promptLogPath) {
              await fs.writeFile(debug.promptLogPath, `lynx prompt ${round}`, "utf8");
            }
            return {
              passed: false,
              issues: [{ category: "other", message: `still bad ${round}` }],
              requiredChanges: [`fix round ${round}`],
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
        compressImagesImpl: compressImagesNoop,
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
        renderByTemplateV2Impl: async ({ outputDir, renderScript }) => {
          assert.equal(renderScript.scenes[0]?.subtitle, "round3");
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
            lynxReviewPaths: input.lynxReviewPaths,
            lynxPromptLogPaths: input.lynxPromptLogPaths,
            ocelotRevisionPaths: input.ocelotRevisionPaths,
          };
        },
      },
    );

    assert.equal(ocelotRound, 3);
    assert.equal(summary.ocelotRevisionPaths.length, 3);
    assert.equal(summary.lynxReviewPaths.length, 3);
    assert.equal(summary.lynxPromptLogPaths.length, 3);
  });
});

test("fails workflow when Lynx review throws", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    await assert.rejects(
      runStoryWorkflowV2(
        {
          sourceDir,
          enableLynxReview: true,
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
          lynxAgentClient: {
            async reviewRenderScript({ debug }) {
              if (debug?.promptLogPath) {
                await fs.writeFile(debug.promptLogPath, "lynx prompt", "utf8");
              }
              throw new Error("lynx down");
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
          renderByTemplateV2Impl: async () => {
            throw new Error("not reached");
          },
        },
      ),
      /lynx down/,
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
    assert.match(errorLog, /lynx down/);
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
