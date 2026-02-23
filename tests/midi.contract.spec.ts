import test from "node:test";
import assert from "node:assert/strict";

import {
  validateMidiComposition,
  type MidiComposition,
} from "../src/contracts/midi.types.ts";

const buildValidMidi = (): MidiComposition => ({
  bpm: 96,
  timeSignature: "4/4",
  durationMs: 30000,
  tracks: [
    {
      name: "Piano",
      channel: 0,
      program: 0,
      notes: [
        { pitch: 60, startMs: 0, durationMs: 500, velocity: 90 },
        { pitch: 64, startMs: 500, durationMs: 500, velocity: 88 },
      ],
    },
    {
      name: "Strings",
      channel: 1,
      program: 48,
      notes: [{ pitch: 55, startMs: 0, durationMs: 1000, velocity: 70 }],
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
      notes: [{ pitch: 36, startMs: 0, durationMs: 250, velocity: 100 }],
    },
  ],
});

test("validateMidiComposition accepts canonical 4-track midi json", () => {
  const result = validateMidiComposition(buildValidMidi());
  assert.equal(result.valid, true);
  assert.ok(result.midi);
});

test("validateMidiComposition rejects wrong track order/program", () => {
  const input = buildValidMidi();
  input.tracks[1] = {
    name: "Bass",
    channel: 1,
    program: 33,
    notes: [],
  };
  const result = validateMidiComposition(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("tracks[1].name")));
  assert.ok(result.errors.some((error) => error.includes("tracks[1].program")));
});

test("validateMidiComposition rejects note out of duration", () => {
  const input = buildValidMidi();
  input.tracks[0]!.notes.push({
    pitch: 64,
    startMs: 29950,
    durationMs: 500,
    velocity: 80,
  });
  const result = validateMidiComposition(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must end within durationMs")));
});

