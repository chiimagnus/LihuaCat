import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  FluidSynthSynthesisError,
  synthesizeMidiToWavWithFluidSynth,
} from "../src/tools/audio/midi-to-wav-fluidsynth.ts";

test("synthesizeMidiToWavWithFluidSynth runs fluidsynth with expected args", async () => {
  await withTempDir(async (dir) => {
    const midiPath = path.join(dir, "music.mid");
    const wavPath = path.join(dir, "music.wav");
    const sf2Path = path.join(dir, "FluidR3_GM.sf2");
    await fs.writeFile(midiPath, "mid");
    await fs.writeFile(sf2Path, "sf2");

    let seenArgs: string[] = [];
    const result = await synthesizeMidiToWavWithFluidSynth({
      midiPath,
      wavPath,
      soundFontPath: sf2Path,
      sampleRate: 44100,
      runner: async ({ command, args }) => {
        assert.equal(command, "fluidsynth");
        seenArgs = args;
        await fs.writeFile(wavPath, "wav");
        return { code: 0, stdout: "", stderr: "" };
      },
    });

    assert.equal(result.wavPath, wavPath);
    assert.deepEqual(seenArgs, [
      "-ni",
      "-F",
      wavPath,
      "-r",
      "44100",
      sf2Path,
      midiPath,
    ]);
  });
});

test("synthesizeMidiToWavWithFluidSynth throws when soundfont is missing", async () => {
  await withTempDir(async (dir) => {
    const midiPath = path.join(dir, "music.mid");
    const wavPath = path.join(dir, "music.wav");
    await fs.writeFile(midiPath, "mid");

    await assert.rejects(async () => {
      try {
        await synthesizeMidiToWavWithFluidSynth({
          midiPath,
          wavPath,
          soundFontPath: path.join(dir, "missing.sf2"),
          env: {},
          runner: async () => ({ code: 0, stdout: "", stderr: "" }),
        });
      } catch (error) {
        assert.ok(error instanceof FluidSynthSynthesisError);
        assert.equal(error.code, "soundfont_not_found");
        throw error;
      }
    }, FluidSynthSynthesisError);
  });
});

test("synthesizeMidiToWavWithFluidSynth throws on fluidsynth failure and keeps midi", async () => {
  await withTempDir(async (dir) => {
    const midiPath = path.join(dir, "music.mid");
    const wavPath = path.join(dir, "music.wav");
    const sf2Path = path.join(dir, "FluidR3_GM.sf2");
    await fs.writeFile(midiPath, "mid");
    await fs.writeFile(sf2Path, "sf2");

    await assert.rejects(
      synthesizeMidiToWavWithFluidSynth({
        midiPath,
        wavPath,
        soundFontPath: sf2Path,
        runner: async () => ({
          code: 1,
          stdout: "",
          stderr: "failed to synthesize",
        }),
      }),
      /failed to synthesize/,
    );

    await assert.doesNotReject(fs.access(midiPath));
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-fluidsynth-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
