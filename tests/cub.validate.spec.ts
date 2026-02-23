import test from "node:test";
import assert from "node:assert/strict";

import { validateCubOutput } from "../src/subagents/cub/cub.validate.ts";
import type { CreativePlan } from "../src/contracts/creative-plan.types.ts";
import type { MidiComposition } from "../src/contracts/midi.types.ts";

const creativePlan: CreativePlan = {
  storyBriefRef: "/tmp/run/story-brief.json",
  narrativeArc: {
    opening: "warm",
    development: "lift",
    climax: "peak",
    resolution: "calm",
  },
  visualDirection: {
    style: "film",
    pacing: "medium",
    transitionTone: "restrained",
    subtitleStyle: "short",
  },
  musicIntent: {
    moodKeywords: ["warm", "nostalgic"],
    bpmTrend: "arc",
    keyMoments: [{ label: "climax", timeMs: 18000 }],
    instrumentationHints: ["piano", "strings"],
    durationMs: 30000,
  },
  alignmentPoints: [{ timeMs: 18000, visualCue: "close-up", musicCue: "lift" }],
};

const buildValidMidi = (): MidiComposition => ({
  bpm: 95,
  timeSignature: "4/4",
  durationMs: 30000,
  tracks: [
    {
      name: "Piano",
      channel: 0,
      program: 0,
      notes: [{ pitch: 60, startMs: 0, durationMs: 500, velocity: 90 }],
    },
    {
      name: "Strings",
      channel: 1,
      program: 48,
      notes: [{ pitch: 55, startMs: 0, durationMs: 1000, velocity: 72 }],
    },
    {
      name: "Bass",
      channel: 2,
      program: 33,
      notes: [{ pitch: 36, startMs: 0, durationMs: 500, velocity: 92 }],
    },
    {
      name: "Drums",
      channel: 9,
      program: 0,
      notes: [{ pitch: 36, startMs: 0, durationMs: 250, velocity: 96 }],
    },
  ],
});

test("validateCubOutput accepts valid midi and creative plan alignment", () => {
  const result = validateCubOutput(buildValidMidi(), { creativePlan });
  assert.equal(result.valid, true);
  assert.ok(result.midi);
});

test("validateCubOutput rejects duration mismatch with creative plan", () => {
  const invalid = buildValidMidi();
  invalid.durationMs = 28000;
  const result = validateCubOutput(invalid, { creativePlan });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("durationMs must match")));
});

test("validateCubOutput rejects invalid midi structure", () => {
  const invalid = buildValidMidi();
  invalid.tracks[0]!.notes[0]!.startMs = -1;
  const result = validateCubOutput(invalid, { creativePlan });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("startMs")));
});

