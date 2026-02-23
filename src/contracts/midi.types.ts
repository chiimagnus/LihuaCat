export type MidiTrackName = "Piano" | "Strings" | "Bass" | "Drums";

export type MidiNote = {
  pitch: number;
  startMs: number;
  durationMs: number;
  velocity: number;
};

export type MidiTrack = {
  name: MidiTrackName;
  channel: number;
  program: number;
  notes: MidiNote[];
};

export type MidiComposition = {
  bpm: number;
  timeSignature: "4/4";
  durationMs: number;
  tracks: MidiTrack[];
};

export type MidiValidationResult = {
  valid: boolean;
  errors: string[];
};

export const midiOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bpm", "timeSignature", "durationMs", "tracks"],
  properties: {
    bpm: { type: "integer", minimum: 40, maximum: 240 },
    timeSignature: { type: "string", enum: ["4/4"] },
    durationMs: { type: "integer", minimum: 1 },
    tracks: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "channel", "program", "notes"],
        properties: {
          name: { type: "string", enum: ["Piano", "Strings", "Bass", "Drums"] },
          channel: { type: "integer", minimum: 0, maximum: 15 },
          program: { type: "integer", minimum: 0, maximum: 127 },
          notes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["pitch", "startMs", "durationMs", "velocity"],
              properties: {
                pitch: { type: "integer", minimum: 0, maximum: 127 },
                startMs: { type: "integer", minimum: 0 },
                durationMs: { type: "integer", minimum: 1 },
                velocity: { type: "integer", minimum: 1, maximum: 127 },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const CANONICAL_MIDI_TRACKS: ReadonlyArray<{
  name: MidiTrackName;
  channel: number;
  program: number;
}> = [
  { name: "Piano", channel: 0, program: 0 },
  { name: "Strings", channel: 1, program: 48 },
  { name: "Bass", channel: 2, program: 33 },
  { name: "Drums", channel: 9, program: 0 },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const validateMidiComposition = (
  input: unknown,
): MidiValidationResult & { midi?: MidiComposition } => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ["midi-json must be an object"] };
  }

  if (!isIntegerInRange(input.bpm, 40, 240)) {
    errors.push("bpm must be an integer between 40 and 240");
  }
  if (input.timeSignature !== "4/4") {
    errors.push("timeSignature must be 4/4");
  }
  if (!isPositiveInteger(input.durationMs)) {
    errors.push("durationMs must be a positive integer");
  }

  if (!Array.isArray(input.tracks) || input.tracks.length !== CANONICAL_MIDI_TRACKS.length) {
    errors.push("tracks must contain exactly 4 tracks (Piano/Strings/Bass/Drums)");
  } else {
    input.tracks.forEach((track, index) => {
      const expected = CANONICAL_MIDI_TRACKS[index];
      if (!isRecord(track)) {
        errors.push(`tracks[${index}] must be an object`);
        return;
      }

      if (track.name !== expected?.name) {
        errors.push(`tracks[${index}].name must be ${expected?.name}`);
      }
      if (!isIntegerInRange(track.channel, 0, 15)) {
        errors.push(`tracks[${index}].channel must be 0..15`);
      } else if (track.channel !== expected?.channel) {
        errors.push(`tracks[${index}].channel must be ${expected?.channel}`);
      }
      if (!isIntegerInRange(track.program, 0, 127)) {
        errors.push(`tracks[${index}].program must be 0..127`);
      } else if (track.program !== expected?.program) {
        errors.push(`tracks[${index}].program must be ${expected?.program}`);
      }

      if (!Array.isArray(track.notes)) {
        errors.push(`tracks[${index}].notes must be an array`);
        return;
      }

      let lastStartMs = -1;
      track.notes.forEach((note, noteIndex) => {
        if (!isRecord(note)) {
          errors.push(`tracks[${index}].notes[${noteIndex}] must be an object`);
          return;
        }
        if (!isIntegerInRange(note.pitch, 0, 127)) {
          errors.push(`tracks[${index}].notes[${noteIndex}].pitch must be 0..127`);
        }
        if (!isIntegerInRange(note.velocity, 1, 127)) {
          errors.push(`tracks[${index}].notes[${noteIndex}].velocity must be 1..127`);
        }
        if (!isNonNegativeInteger(note.startMs)) {
          errors.push(`tracks[${index}].notes[${noteIndex}].startMs must be >= 0 integer`);
        }
        if (!isPositiveInteger(note.durationMs)) {
          errors.push(`tracks[${index}].notes[${noteIndex}].durationMs must be > 0 integer`);
        }

        if (isNonNegativeInteger(note.startMs)) {
          if (note.startMs < lastStartMs) {
            errors.push(`tracks[${index}].notes must be sorted by startMs`);
          }
          lastStartMs = note.startMs;
        }

        if (
          isPositiveInteger(input.durationMs) &&
          isNonNegativeInteger(note.startMs) &&
          isPositiveInteger(note.durationMs) &&
          note.startMs + note.durationMs > input.durationMs
        ) {
          errors.push(
            `tracks[${index}].notes[${noteIndex}] must end within durationMs`,
          );
        }
      });
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], midi: input as MidiComposition };
};
