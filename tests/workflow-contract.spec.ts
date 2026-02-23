import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runStoryWorkflowV2 } from "../src/app/workflow/start-story-run.ts";
import { validateCreativePlan } from "../src/contracts/creative-plan.types.ts";
import { validateVisualScript } from "../src/contracts/visual-script.types.ts";
import { validateMidiComposition } from "../src/contracts/midi.types.ts";

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
              alignmentPoints: [{ timeMs: 15000, visualCue: "close-up", musicCue: "lift" }],
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

    const coreStages = stages.filter((stage) => !stage.endsWith("_progress"));
    assert.deepEqual(coreStages, [
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
    assert.ok(summary.creativePlanPath?.endsWith("creative-plan.json"));
    assert.ok(summary.visualScriptPath?.endsWith("visual-script.json"));
    assert.ok(summary.reviewLogPath?.endsWith("review-log.json"));
    assert.ok(summary.midiJsonPath?.endsWith("music-json.json"));
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

test("workflow contract: new creative contracts stay JSON serializable", () => {
  const creativePlan = {
    storyBriefRef: "/tmp/run/story-brief.json",
    narrativeArc: {
      opening: "warm",
      development: "rise",
      climax: "peak",
      resolution: "calm",
    },
    visualDirection: {
      style: "cinematic",
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
    alignmentPoints: [{ timeMs: 15000, visualCue: "close-up", musicCue: "drum lift" }],
  };
  const visualScript = {
    creativePlanRef: "/tmp/run/creative-plan.json",
    video: { width: 1080, height: 1920, fps: 30 },
    scenes: [
      {
        sceneId: "scene_001",
        photoRef: "1.jpg",
        subtitle: "hello",
        subtitlePosition: "bottom" as const,
        durationSec: 30,
        transition: { type: "cut" as const, durationMs: 0 },
      },
    ],
  };
  const midiJson = {
    bpm: 96,
    timeSignature: "4/4" as const,
    durationMs: 30000,
    tracks: [
      { name: "Piano" as const, channel: 0, program: 0, notes: [] },
      { name: "Strings" as const, channel: 1, program: 48, notes: [] },
      { name: "Bass" as const, channel: 2, program: 33, notes: [] },
      { name: "Drums" as const, channel: 9, program: 0, notes: [] },
    ],
  };

  const creativeRoundtrip = JSON.parse(JSON.stringify(creativePlan));
  const visualRoundtrip = JSON.parse(JSON.stringify(visualScript));
  const midiRoundtrip = JSON.parse(JSON.stringify(midiJson));

  const creativeResult = validateCreativePlan(creativeRoundtrip);
  const visualResult = validateVisualScript(visualRoundtrip);
  const midiResult = validateMidiComposition(midiRoundtrip);

  assert.equal(creativeResult.valid, true);
  assert.equal(visualResult.valid, true);
  assert.equal(midiResult.valid, true);
});
