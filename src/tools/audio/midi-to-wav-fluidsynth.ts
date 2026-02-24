import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

type CommandRunnerResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (input: {
  command: string;
  args: string[];
}) => Promise<CommandRunnerResult>;

export type MidiToWavWithFluidSynthInput = {
  midiPath: string;
  wavPath: string;
  soundFontPath?: string;
  sampleRate?: number;
  env?: NodeJS.ProcessEnv;
  runner?: CommandRunner;
};

export type FluidSynthSynthesisErrorCode =
  | "soundfont_not_found"
  | "fluidsynth_not_found"
  | "fluidsynth_failed"
  | "midi_missing"
  | "wav_missing";

export class FluidSynthSynthesisError extends Error {
  readonly code: FluidSynthSynthesisErrorCode;

  constructor(code: FluidSynthSynthesisErrorCode, message: string) {
    super(message);
    this.name = "FluidSynthSynthesisError";
    this.code = code;
  }
}

const DEFAULT_SOUND_FONT_CANDIDATES = [
  "/opt/homebrew/share/soundfonts/FluidR3_GM.sf2",
  "/usr/local/share/soundfonts/FluidR3_GM.sf2",
  "/usr/share/sounds/sf2/FluidR3_GM.sf2",
];

export const synthesizeMidiToWavWithFluidSynth = async ({
  midiPath,
  wavPath,
  soundFontPath,
  sampleRate = 44100,
  env = process.env,
  runner = defaultRunner,
}: MidiToWavWithFluidSynthInput): Promise<{ wavPath: string }> => {
  await assertFileExists(midiPath, "MIDI file", "midi_missing");
  const resolvedSoundFontPath = await resolveSoundFontPath({
    explicitPath: soundFontPath,
    env,
  });
  await fs.mkdir(path.dirname(wavPath), { recursive: true });

  const args = [
    "-ni",
    "-F",
    wavPath,
    "-r",
    String(sampleRate),
    resolvedSoundFontPath,
    midiPath,
  ];

  const result = await runner({
    command: "fluidsynth",
    args,
  });

  if (result.code !== 0) {
    throw new FluidSynthSynthesisError(
      "fluidsynth_failed",
      `fluidsynth failed (code=${result.code}): ${result.stderr || result.stdout || "unknown error"}`,
    );
  }

  await assertFileExists(wavPath, "WAV output", "wav_missing");
  return { wavPath };
};

export const resolveSoundFontPath = async ({
  explicitPath,
  env = process.env,
}: {
  explicitPath?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<string> => {
  const candidates = [
    explicitPath,
    env.LIHUACAT_SOUNDFONT_PATH,
    ...DEFAULT_SOUND_FONT_CANDIDATES,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep trying candidates
    }
  }

  throw new FluidSynthSynthesisError(
    "soundfont_not_found",
    `SoundFont not found. Set LIHUACAT_SOUNDFONT_PATH or install one of: ${DEFAULT_SOUND_FONT_CANDIDATES.join(", ")}`,
  );
};

const assertFileExists = async (
  targetPath: string,
  label: string,
  code: "midi_missing" | "wav_missing",
): Promise<void> => {
  try {
    await fs.access(targetPath);
  } catch {
    throw new FluidSynthSynthesisError(code, `${label} does not exist: ${targetPath}`);
  }
};

const defaultRunner: CommandRunner = async ({ command, args }) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(
        new FluidSynthSynthesisError(
          "fluidsynth_not_found",
          `failed to execute fluidsynth: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
};
