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

const createStoryBrief = () => ({
  intent: {
    coreEmotion: "释然",
    tone: "克制",
    narrativeArc: "起承转合",
    audienceNote: null,
    avoidance: ["不要直白口号"],
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
});

const createCreativePlan = () => ({
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
});

const createMidi = () => ({
  bpm: 96,
  timeSignature: "4/4" as const,
  durationMs: 30000,
  tracks: [
    { name: "Piano" as const, channel: 0, program: 0, notes: [] },
    { name: "Strings" as const, channel: 1, program: 48, notes: [] },
    { name: "Bass" as const, channel: 2, program: 33, notes: [] },
    { name: "Drums" as const, channel: 9, program: 0, notes: [] },
  ],
});

test("ocelot creative director loop converges on second round", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    const kittenRevisionNotes: Array<string[] | undefined> = [];
    let reviewRound = 0;

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
            return createCreativePlan();
          },
          async reviewCreativeAssets() {
            reviewRound += 1;
            if (reviewRound === 1) {
              return {
                passed: false,
                summary: "needs shorter subtitle",
                issues: [{ target: "kitten", message: "subtitle too long" }],
                requiredChanges: [{ target: "kitten", instructions: ["subtitle shorter"] }],
              };
            }
            return {
              passed: true,
              summary: "approved",
              issues: [],
              requiredChanges: [],
            };
          },
          async generateRenderScript() {
            throw new Error("legacy path not used");
          },
        },
        kittenAgentClient: {
          async generateVisualScript({ revisionNotes }) {
            kittenRevisionNotes.push(revisionNotes);
            const subtitle = revisionNotes && revisionNotes.length > 0 ? "v2-fixed" : "v1";
            return {
              creativePlanRef: "/tmp/run/creative-plan.json",
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
        cubAgentClient: {
          async generateMidiJson() {
            return createMidi();
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
          brief: createStoryBrief(),
          attempts: 1,
        }),
        runAudioPipelineImpl: async ({ outputDir }) => {
          const midiPath = path.join(outputDir, "music.mid");
          const wavPath = path.join(outputDir, "music.wav");
          await fs.writeFile(midiPath, "mid", "utf8");
          await fs.writeFile(wavPath, "wav", "utf8");
          return { midiPath, wavPath };
        },
        renderByTemplateV2Impl: async ({ outputDir, renderScript }) => {
          assert.equal(renderScript.scenes[0]?.subtitle, "v2-fixed");
          assert.ok(renderScript.audioTrack?.path.includes("music.wav"));
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

    assert.equal(kittenRevisionNotes.length, 2);
    assert.deepEqual(kittenRevisionNotes[0], undefined);
    assert.deepEqual(kittenRevisionNotes[1], ["subtitle shorter"]);

    const reviewLog = JSON.parse(await fs.readFile(summary.reviewLogPath!, "utf8"));
    assert.equal(reviewLog.finalPassed, true);
    assert.equal(reviewLog.rounds.length, 2);
    await assert.doesNotReject(fs.access(summary.musicMidPath!));
    await assert.doesNotReject(fs.access(summary.musicWavPath!));
  });
});

test("ocelot creative director loop reaches max rounds and continues render", async () => {
  await withTempDir(async (sourceDir) => {
    await fs.writeFile(path.join(sourceDir, "1.jpg"), "fake-image");

    let kittenRound = 0;
    const stages: string[] = [];

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
            return createCreativePlan();
          },
          async reviewCreativeAssets({ round }) {
            return {
              passed: false,
              summary: `still bad ${round}`,
              issues: [{ target: "kitten", message: `issue ${round}` }],
              requiredChanges: [{ target: "kitten", instructions: [`fix round ${round}`] }],
            };
          },
          async generateRenderScript() {
            throw new Error("legacy path not used");
          },
        },
        kittenAgentClient: {
          async generateVisualScript() {
            kittenRound += 1;
            return {
              creativePlanRef: "/tmp/run/creative-plan.json",
              video: { width: 1080, height: 1920, fps: 30 },
              scenes: [
                {
                  sceneId: "scene_001",
                  photoRef: "1.jpg",
                  subtitle: `round-${kittenRound}`,
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
            return createMidi();
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
          brief: createStoryBrief(),
          attempts: 1,
        }),
        runAudioPipelineImpl: async ({ outputDir }) => {
          const midiPath = path.join(outputDir, "music.mid");
          const wavPath = path.join(outputDir, "music.wav");
          await fs.writeFile(midiPath, "mid", "utf8");
          await fs.writeFile(wavPath, "wav", "utf8");
          return { midiPath, wavPath };
        },
        renderByTemplateV2Impl: async ({ outputDir, renderScript }) => {
          assert.equal(renderScript.scenes[0]?.subtitle, "round-3");
          assert.ok(renderScript.audioTrack?.path.includes("music.wav"));
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

    assert.ok(stages.includes("script_warning"));

    const reviewLog = JSON.parse(await fs.readFile(summary.reviewLogPath!, "utf8"));
    assert.equal(reviewLog.finalPassed, false);
    assert.equal(reviewLog.rounds.length, 3);
    assert.match(String(reviewLog.warning), /maxRounds=3/);
    await assert.doesNotReject(fs.access(summary.musicMidPath!));
    await assert.doesNotReject(fs.access(summary.musicWavPath!));
  });
});

const withTempDir = async (run: (sourceDir: string) => Promise<void>) => {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-creative-loop-"));
  try {
    await run(sourceDir);
  } finally {
    await fs.rm(sourceDir, { recursive: true, force: true });
  }
};
