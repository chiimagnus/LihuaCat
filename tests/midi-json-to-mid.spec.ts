import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildDeterministicMidiBytes,
  MidiJsonToMidError,
  writeMidiJsonToMid,
} from "../src/tools/audio/midi-json-to-mid.ts";
import type { MidiComposition } from "../src/contracts/midi.types.ts";

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

test("writeMidiJsonToMid writes deterministic .mid with header and tracks", async () => {
  await withTempDir(async (dir) => {
    const outputPath = path.join(dir, "music.mid");
    const result = await writeMidiJsonToMid({
      midi: buildValidMidi(),
      outputPath,
    });

    assert.equal(result.outputPath, outputPath);
    assert.ok(result.bytes > 0);
    const bytes = await fs.readFile(outputPath);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "MThd");
    assert.equal(countAscii(bytes, "MTrk"), 5);
  });
});

test("buildDeterministicMidiBytes returns stable bytes for same input", () => {
  const midi = buildValidMidi();
  const a = buildDeterministicMidiBytes(midi);
  const b = buildDeterministicMidiBytes(midi);
  assert.deepEqual(a, b);
});

test("writeMidiJsonToMid throws when midi json is invalid", async () => {
  await withTempDir(async (dir) => {
    const invalid = buildValidMidi();
    invalid.tracks[0]!.notes[0]!.startMs = -1;
    await assert.rejects(
      writeMidiJsonToMid({
        midi: invalid,
        outputPath: path.join(dir, "bad.mid"),
      }),
      MidiJsonToMidError,
    );
  });
});

const countAscii = (bytes: Uint8Array, token: string): number => {
  const tokenBytes = Buffer.from(token, "ascii");
  let count = 0;
  for (let i = 0; i <= bytes.length - tokenBytes.length; i += 1) {
    let matched = true;
    for (let j = 0; j < tokenBytes.length; j += 1) {
      if (bytes[i + j] !== tokenBytes[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      count += 1;
    }
  }
  return count;
};

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-midi-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

