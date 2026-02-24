import test from "node:test";
import assert from "node:assert/strict";

import { reviseCreativeAssetsWithOcelot } from "../src/app/workflow/revise-creative-assets-with-ocelot.ts";
import type { OcelotAgentClient } from "../src/agents/ocelot/ocelot.client.ts";
import type { KittenAgentClient } from "../src/subagents/kitten/kitten.client.ts";
import type { CubAgentClient } from "../src/subagents/cub/cub.client.ts";

const baseStoryBrief = {
  intent: {
    coreEmotion: "释然",
    tone: "克制",
    narrativeArc: "起承转合",
    audienceNote: null,
    avoidance: ["不要岁月静好"],
    rawUserWords: "很轻。",
  },
  photos: [
    {
      photoRef: "1.jpg",
      userSaid: "",
      emotionalWeight: 0.5,
      suggestedRole: "开场",
      backstory: "",
      analysis: "视觉描述",
    },
    {
      photoRef: "2.jpg",
      userSaid: "",
      emotionalWeight: 0.5,
      suggestedRole: "收尾",
      backstory: "",
      analysis: "视觉描述",
    },
  ],
  narrative: {
    arc: "起承转合",
    beats: [
      {
        photoRefs: ["1.jpg", "2.jpg"],
        moment: "moment",
        emotion: "emotion",
        duration: "short",
        transition: "cut",
      },
    ],
  },
} as const;

const creativePlan = {
  storyBriefRef: "/tmp/run/story-brief.json",
  narrativeArc: {
    opening: "a",
    development: "b",
    climax: "c",
    resolution: "d",
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

const makeVisualScript = (subtitle: string) => ({
  creativePlanRef: "/tmp/run/creative-plan.json",
  video: { width: 1080, height: 1920, fps: 30 },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle,
      subtitlePosition: "bottom" as const,
      durationSec: 15,
      transition: { type: "cut" as const, durationMs: 0 },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.jpg",
      subtitle,
      subtitlePosition: "bottom" as const,
      durationSec: 15,
      transition: { type: "cut" as const, durationMs: 0 },
    },
  ],
});

const makeMidi = (seed: number) => ({
  bpm: 96,
  timeSignature: "4/4" as const,
  durationMs: 30000,
  tracks: [
    {
      name: "Piano" as const,
      channel: 0,
      program: 0,
      notes: [{ pitch: 60, startMs: seed, durationMs: 500, velocity: 90 }],
    },
    {
      name: "Strings" as const,
      channel: 1,
      program: 48,
      notes: [],
    },
    {
      name: "Bass" as const,
      channel: 2,
      program: 33,
      notes: [],
    },
    {
      name: "Drums" as const,
      channel: 9,
      program: 0,
      notes: [],
    },
  ],
});

test("returns immediately when ocelot review passes in first round", async () => {
  const result = await reviseCreativeAssetsWithOcelot({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [
      { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
      { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
    ],
    ocelotClient: buildOcelotClient({
      onReview: async () => ({
        passed: true,
        summary: "ok",
        issues: [],
        requiredChanges: [],
      }),
    }),
    kittenClient: buildKittenClient({ onGenerate: async () => makeVisualScript("ok") }),
    cubClient: buildCubClient({ onGenerate: async () => makeMidi(0) }),
    maxRounds: 3,
  });

  assert.equal(result.finalPassed, true);
  assert.equal(result.rounds.length, 1);
  assert.equal(result.reviewLog.finalPassed, true);
});

test("propagates review required changes to kitten and cub revision notes", async () => {
  const kittenNotes: Array<string[] | undefined> = [];
  const cubNotes: Array<string[] | undefined> = [];
  let reviewRound = 0;

  const result = await reviseCreativeAssetsWithOcelot({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [
      { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
      { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
    ],
    ocelotClient: buildOcelotClient({
      onReview: async () => {
        reviewRound += 1;
        if (reviewRound === 1) {
          return {
            passed: false,
            summary: "needs changes",
            issues: [{ target: "cub", message: "rhythm too early" }],
            requiredChanges: [
              { target: "kitten", instructions: ["subtitle shorter"] },
              { target: "cub", instructions: ["delay drum lift"] },
            ],
          };
        }
        return {
          passed: true,
          summary: "ok",
          issues: [],
          requiredChanges: [],
        };
      },
    }),
    kittenClient: buildKittenClient({
      onGenerate: async ({ revisionNotes }) => {
        kittenNotes.push(revisionNotes);
        return makeVisualScript("ok");
      },
    }),
    cubClient: buildCubClient({
      onGenerate: async ({ revisionNotes }) => {
        cubNotes.push(revisionNotes);
        return makeMidi(0);
      },
    }),
    maxRounds: 3,
  });

  assert.equal(result.finalPassed, true);
  assert.equal(result.rounds.length, 2);
  assert.deepEqual(kittenNotes[0], undefined);
  assert.deepEqual(cubNotes[0], undefined);
  assert.deepEqual(kittenNotes[1], ["subtitle shorter"]);
  assert.deepEqual(cubNotes[1], ["delay drum lift"]);
});

test("returns warning and latest creative assets when max rounds reached", async () => {
  const result = await reviseCreativeAssetsWithOcelot({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [
      { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
      { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
    ],
    ocelotClient: buildOcelotClient({
      onReview: async ({ round }) => ({
        passed: false,
        summary: `still bad ${round}`,
        issues: [{ target: "kitten", message: "tone mismatch" }],
        requiredChanges: [{ target: "kitten", instructions: [`fix round ${round}`] }],
      }),
    }),
    kittenClient: buildKittenClient({
      onGenerate: async ({ revisionNotes }) =>
        makeVisualScript(revisionNotes && revisionNotes.length > 0 ? "fixed" : "first"),
    }),
    cubClient: buildCubClient({ onGenerate: async () => makeMidi(120) }),
    maxRounds: 2,
  });

  assert.equal(result.finalPassed, false);
  assert.equal(result.rounds.length, 2);
  assert.ok(result.warning);
  assert.equal(result.reviewLog.finalPassed, false);
  assert.equal(result.reviewLog.warning, result.warning);
});

test("falls back to no-music render when cub generation fails", async () => {
  const result = await reviseCreativeAssetsWithOcelot({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [
      { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
      { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
    ],
    ocelotClient: buildOcelotClient({
      onReview: async () => ({
        passed: true,
        summary: "not reached",
        issues: [],
        requiredChanges: [],
      }),
    }),
    kittenClient: buildKittenClient({ onGenerate: async () => makeVisualScript("ok") }),
    cubClient: buildCubClient({
      onGenerate: async () => {
        throw new Error("cub unavailable");
      },
    }),
    maxRounds: 3,
  });

  assert.equal(result.finalPassed, false);
  assert.ok(result.warning?.includes("Cub generation failed"));
  assert.equal(result.midi.tracks.every((track) => track.notes.length === 0), true);
  assert.equal(result.reviewLog.rounds[0]?.issues[0]?.target, "cub");
});

test("retries kitten generation within the same round on validation error", async () => {
  const kittenNotes: Array<string[] | undefined> = [];
  let kittenAttempts = 0;

  const result = await reviseCreativeAssetsWithOcelot({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [
      { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
      { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
    ],
    ocelotClient: buildOcelotClient({
      onReview: async () => ({
        passed: true,
        summary: "ok",
        issues: [],
        requiredChanges: [],
      }),
    }),
    kittenClient: buildKittenClient({
      onGenerate: async ({ revisionNotes }) => {
        kittenAttempts += 1;
        kittenNotes.push(revisionNotes);
        if (kittenAttempts === 1) {
          throw new Error("kitten output invalid: total visual duration must equal 30s");
        }
        return makeVisualScript("ok");
      },
    }),
    cubClient: buildCubClient({ onGenerate: async () => makeMidi(0) }),
    maxRounds: 3,
  });

  assert.equal(kittenAttempts, 2);
  assert.equal(result.finalPassed, true);
  assert.equal(result.rounds.length, 1);
  assert.deepEqual(kittenNotes[0], undefined);
  assert.ok(kittenNotes[1]?.some((note) => note.includes("自动校验错误")));
});

test("emits progress lifecycle events in expected order", async () => {
  const events: string[] = [];

  await reviseCreativeAssetsWithOcelot({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [
      { photoRef: "1.jpg", path: "/tmp/photos/1.jpg" },
      { photoRef: "2.jpg", path: "/tmp/photos/2.jpg" },
    ],
    ocelotClient: buildOcelotClient({
      onReview: async () => ({
        passed: true,
        summary: "ok",
        issues: [],
        requiredChanges: [],
      }),
    }),
    kittenClient: buildKittenClient({ onGenerate: async () => makeVisualScript("ok") }),
    cubClient: buildCubClient({ onGenerate: async () => makeMidi(0) }),
    maxRounds: 3,
    onProgress: (event) => {
      events.push(event.type);
    },
  });

  assert.deepEqual(events, [
    "round_start",
    "kitten_generate_start",
    "kitten_generate_done",
    "cub_generate_start",
    "cub_generate_done",
    "ocelot_review_start",
    "ocelot_review_done",
  ]);
});

const buildOcelotClient = ({
  onReview,
}: {
  onReview: NonNullable<OcelotAgentClient["reviewCreativeAssets"]>;
}): OcelotAgentClient => ({
  async generateCreativePlan() {
    return creativePlan;
  },
  reviewCreativeAssets: onReview,
  async generateRenderScript() {
    throw new Error("not used");
  },
});

const buildKittenClient = ({
  onGenerate,
}: {
  onGenerate: NonNullable<KittenAgentClient["generateVisualScript"]>;
}): KittenAgentClient => ({
  generateVisualScript: onGenerate,
});

const buildCubClient = ({
  onGenerate,
}: {
  onGenerate: NonNullable<CubAgentClient["generateMidiJson"]>;
}): CubAgentClient => ({
  generateMidiJson: onGenerate,
});
