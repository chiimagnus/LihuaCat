import path from "node:path";

import type { MidiComposition } from "../../contracts/midi.types.ts";
import { writeMidiJsonToMid } from "./midi-json-to-mid.ts";
import { synthesizeMidiToWavWithFluidSynth } from "./midi-to-wav-fluidsynth.ts";

export const runAudioPipeline = async ({
  midiJson,
  outputDir,
  soundFontPath,
}: {
  midiJson: MidiComposition;
  outputDir: string;
  soundFontPath?: string;
}): Promise<{ midiPath: string; wavPath: string }> => {
  const midiPath = path.join(outputDir, "music.mid");
  const wavPath = path.join(outputDir, "music.wav");

  await writeMidiJsonToMid({
    midi: midiJson,
    outputPath: midiPath,
  });

  await synthesizeMidiToWavWithFluidSynth({
    midiPath,
    wavPath,
    soundFontPath,
  });

  return {
    midiPath,
    wavPath,
  };
};

