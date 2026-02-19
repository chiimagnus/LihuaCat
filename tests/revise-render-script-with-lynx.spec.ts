import test from "node:test";
import assert from "node:assert/strict";

import { reviseRenderScriptWithLynx } from "../src/app/workflow/revise-render-script-with-lynx.ts";
import type { RenderScript } from "../src/contracts/render-script.types.ts";
import { OcelotAgentResponseParseError } from "../src/agents/ocelot/ocelot.client.ts";

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
} as const;

const makeScript = (subtitle: string): RenderScript => ({
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
});

test("returns immediately when Lynx passes in first round", async () => {
  const calls: Array<{ round: number; revisionNotes?: string[] }> = [];

  const result = await reviseRenderScriptWithLynx({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [{ photoRef: "1.jpg", path: "/tmp/photos/1.jpg" }],
    video: { width: 1080, height: 1920, fps: 30 },
    ocelotClient: {
      async generateRenderScript(req) {
        calls.push({ round: 1, revisionNotes: req.revisionNotes });
        return makeScript("ok");
      },
    },
    lynxClient: {
      async reviewRenderScript() {
        return { passed: true, issues: [], requiredChanges: [] };
      },
    },
    maxRounds: 3,
  });

  assert.equal(result.finalPassed, true);
  assert.equal(result.rounds.length, 1);
  assert.equal(result.rounds[0]?.lynxReview.passed, true);
  assert.deepEqual(calls[0]?.revisionNotes, undefined);
});

test("propagates requiredChanges as revisionNotes to Ocelot", async () => {
  let ocelotCalls = 0;
  const receivedNotes: Array<string[] | undefined> = [];

  const result = await reviseRenderScriptWithLynx({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [{ photoRef: "1.jpg", path: "/tmp/photos/1.jpg" }],
    video: { width: 1080, height: 1920, fps: 30 },
    ocelotClient: {
      async generateRenderScript(req) {
        ocelotCalls += 1;
        receivedNotes.push(req.revisionNotes);
        return makeScript(`v${ocelotCalls}`);
      },
    },
    lynxClient: {
      async reviewRenderScript({ round }) {
        if (round === 1) {
          return {
            passed: false,
            issues: [{ category: "avoidance_conflict", message: "conflict" }],
            requiredChanges: ["Remove forbidden phrase", "Use restrained tone"],
          };
        }
        return { passed: true, issues: [], requiredChanges: [] };
      },
    },
    maxRounds: 3,
  });

  assert.equal(result.finalPassed, true);
  assert.equal(result.rounds.length, 2);
  assert.deepEqual(receivedNotes[0], undefined);
  assert.deepEqual(receivedNotes[1], ["Remove forbidden phrase", "Use restrained tone"]);
});

test("returns last version when reaching max rounds without passing", async () => {
  const result = await reviseRenderScriptWithLynx({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [{ photoRef: "1.jpg", path: "/tmp/photos/1.jpg" }],
    video: { width: 1080, height: 1920, fps: 30 },
    ocelotClient: {
      async generateRenderScript({ revisionNotes }) {
        const suffix = revisionNotes ? `notes:${revisionNotes.length}` : "first";
        return makeScript(suffix);
      },
    },
    lynxClient: {
      async reviewRenderScript({ round }) {
        return {
          passed: false,
          issues: [{ category: "other", message: `still bad ${round}` }],
          requiredChanges: [`fix round ${round}`],
        };
      },
    },
    maxRounds: 3,
  });

  assert.equal(result.finalPassed, false);
  assert.equal(result.rounds.length, 3);
  assert.equal(result.finalScript.scenes[0]?.subtitle, "notes:1");
});

test("throws when Lynx throws", async () => {
  await assert.rejects(
    reviseRenderScriptWithLynx({
      storyBriefRef: "/tmp/run/story-brief.json",
      storyBrief: baseStoryBrief as any,
      photos: [{ photoRef: "1.jpg", path: "/tmp/photos/1.jpg" }],
      video: { width: 1080, height: 1920, fps: 30 },
      ocelotClient: {
        async generateRenderScript() {
          return makeScript("v1");
        },
      },
      lynxClient: {
        async reviewRenderScript() {
          throw new Error("lynx down");
        },
      },
      maxRounds: 3,
    }),
    /lynx down/,
  );
});

test("retries Ocelot within a round when output fails validation", async () => {
  let calls = 0;
  const seenNotes: Array<string[] | undefined> = [];

  const result = await reviseRenderScriptWithLynx({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [{ photoRef: "1.jpg", path: "/tmp/photos/1.jpg" }],
    video: { width: 1080, height: 1920, fps: 30 },
    maxRounds: 3,
    maxOcelotRetriesPerRound: 2,
    ocelotClient: {
      async generateRenderScript({ revisionNotes }) {
        calls += 1;
        seenNotes.push(revisionNotes);
        if (calls === 1) {
          throw new OcelotAgentResponseParseError(
            "render-script semantics invalid: photoRef 1.jpg is not used in scenes",
          );
        }
        return makeScript("ok");
      },
    },
    lynxClient: {
      async reviewRenderScript() {
        return { passed: true, issues: [], requiredChanges: [] };
      },
    },
  });

  assert.equal(result.finalPassed, true);
  assert.equal(calls, 2);
  assert.deepEqual(seenNotes[0], undefined);
  assert.ok(Array.isArray(seenNotes[1]));
  assert.ok((seenNotes[1] ?? []).some((n) => n.includes("Previous attempt failed automated validation")));
  assert.ok((seenNotes[1] ?? []).some((n) => n.includes("render-script semantics invalid")));
});

test("emits progress events for round/attempt/review lifecycle", async () => {
  const events: Array<{ type: string; round: number }> = [];
  let calls = 0;

  await reviseRenderScriptWithLynx({
    storyBriefRef: "/tmp/run/story-brief.json",
    storyBrief: baseStoryBrief as any,
    photos: [{ photoRef: "1.jpg", path: "/tmp/photos/1.jpg" }],
    video: { width: 1080, height: 1920, fps: 30 },
    maxRounds: 3,
    maxOcelotRetriesPerRound: 1,
    onProgress: (event) => {
      events.push({ type: event.type, round: event.round });
    },
    ocelotClient: {
      async generateRenderScript() {
        calls += 1;
        if (calls === 1) {
          throw new OcelotAgentResponseParseError("render-script semantics invalid: missing scenes");
        }
        return makeScript("ok");
      },
    },
    lynxClient: {
      async reviewRenderScript() {
        return { passed: true, issues: [], requiredChanges: [] };
      },
    },
  });

  assert.deepEqual(events.map((e) => e.type), [
    "round_start",
    "ocelot_attempt_start",
    "ocelot_attempt_failed",
    "ocelot_attempt_start",
    "lynx_review_start",
    "lynx_review_done",
  ]);
});
