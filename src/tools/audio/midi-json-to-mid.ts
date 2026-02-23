import fs from "node:fs/promises";
import path from "node:path";

import {
  validateMidiComposition,
  type MidiComposition,
  type MidiNote,
} from "../../contracts/midi.types.ts";

const PPQ = 480;

export class MidiJsonToMidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MidiJsonToMidError";
  }
}

export const writeMidiJsonToMid = async ({
  midi,
  outputPath,
}: {
  midi: MidiComposition;
  outputPath: string;
}): Promise<{ outputPath: string; bytes: number }> => {
  const validation = validateMidiComposition(midi);
  if (!validation.valid || !validation.midi) {
    throw new MidiJsonToMidError(`invalid midi json: ${validation.errors.join("; ")}`);
  }

  const bytes = buildMidiFile(validation.midi);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);

  return {
    outputPath,
    bytes: bytes.length,
  };
};

const buildMidiFile = (midi: MidiComposition): Uint8Array => {
  const tempoTrack = createTempoTrack(midi.bpm);
  const instrumentTracks = midi.tracks.map((track) => createInstrumentTrack(track, midi.bpm));

  const headerChunk = concatBytes([
    textBytes("MThd"),
    uint32Bytes(6),
    uint16Bytes(1), // format 1
    uint16Bytes(1 + instrumentTracks.length), // tempo track + instrument tracks
    uint16Bytes(PPQ),
  ]);

  const trackChunks = [tempoTrack, ...instrumentTracks].map((trackData) =>
    concatBytes([textBytes("MTrk"), uint32Bytes(trackData.length), trackData]),
  );

  return concatBytes([headerChunk, ...trackChunks]);
};

const createTempoTrack = (bpm: number): Uint8Array => {
  const microsecondsPerQuarter = Math.round(60000000 / bpm);
  const events = concatBytes([
    // delta=0, set tempo meta
    vlqBytes(0),
    new Uint8Array([
      0xff,
      0x51,
      0x03,
      (microsecondsPerQuarter >> 16) & 0xff,
      (microsecondsPerQuarter >> 8) & 0xff,
      microsecondsPerQuarter & 0xff,
    ]),
    // delta=0, time signature 4/4
    vlqBytes(0),
    new Uint8Array([0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08]),
    // delta=0, end of track
    vlqBytes(0),
    new Uint8Array([0xff, 0x2f, 0x00]),
  ]);

  return events;
};

const createInstrumentTrack = (
  track: MidiComposition["tracks"][number],
  bpm: number,
): Uint8Array => {
  const notes = [...track.notes];
  const timeline: Array<{
    tick: number;
    type: "on" | "off";
    pitch: number;
    velocity: number;
  }> = [];

  for (const note of notes) {
    timeline.push({
      tick: msToTicks(note.startMs, bpm),
      type: "on",
      pitch: note.pitch,
      velocity: note.velocity,
    });
    timeline.push({
      tick: msToTicks(note.startMs + note.durationMs, bpm),
      type: "off",
      pitch: note.pitch,
      velocity: 0,
    });
  }

  timeline.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    // note-off first at the same tick to avoid hanging notes.
    if (a.type !== b.type) return a.type === "off" ? -1 : 1;
    if (a.pitch !== b.pitch) return a.pitch - b.pitch;
    return a.velocity - b.velocity;
  });

  const chunks: Uint8Array[] = [];
  chunks.push(vlqBytes(0));
  chunks.push(new Uint8Array([0xc0 | (track.channel & 0x0f), track.program & 0x7f]));

  let lastTick = 0;
  for (const event of timeline) {
    const delta = Math.max(0, event.tick - lastTick);
    chunks.push(vlqBytes(delta));
    if (event.type === "on") {
      chunks.push(
        new Uint8Array([
          0x90 | (track.channel & 0x0f),
          event.pitch & 0x7f,
          event.velocity & 0x7f,
        ]),
      );
    } else {
      chunks.push(
        new Uint8Array([
          0x80 | (track.channel & 0x0f),
          event.pitch & 0x7f,
          event.velocity & 0x7f,
        ]),
      );
    }
    lastTick = event.tick;
  }

  chunks.push(vlqBytes(0));
  chunks.push(new Uint8Array([0xff, 0x2f, 0x00]));

  return concatBytes(chunks);
};

const msToTicks = (ms: number, bpm: number): number => {
  const beats = ms / 60000 * bpm;
  return Math.max(0, Math.round(beats * PPQ));
};

const uint16Bytes = (value: number): Uint8Array =>
  new Uint8Array([(value >> 8) & 0xff, value & 0xff]);

const uint32Bytes = (value: number): Uint8Array =>
  new Uint8Array([
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]);

const textBytes = (value: string): Uint8Array =>
  new Uint8Array([...value].map((char) => char.charCodeAt(0)));

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const vlqBytes = (value: number): Uint8Array => {
  let n = value >>> 0;
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.push((n & 0x7f) | 0x80);
    n >>= 7;
  }
  bytes.reverse();
  return new Uint8Array(bytes);
};

export const buildDeterministicMidiBytes = (midi: MidiComposition): Uint8Array => {
  const validation = validateMidiComposition(midi);
  if (!validation.valid || !validation.midi) {
    throw new MidiJsonToMidError(`invalid midi json: ${validation.errors.join("; ")}`);
  }
  return buildMidiFile(validation.midi);
};

export const flattenTrackNotes = (midi: MidiComposition): MidiNote[] => {
  return midi.tracks.flatMap((track) => track.notes.map((note) => ({ ...note })));
};

