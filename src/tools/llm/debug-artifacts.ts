import fs from "node:fs/promises";

import type { CodexPromptInput, LlmDebugArtifacts } from "./llm.types.ts";

export const writeLlmDebugArtifacts = async (options: {
  debug?: LlmDebugArtifacts;
  promptInput: CodexPromptInput;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
}): Promise<void> => {
  const { debug, promptInput, inputSnapshot, outputSnapshot } = options;
  if (!debug) return;

  if (debug.promptLogPath) {
    const textPart = promptInput.find((item) => item.type === "text");
    await fs.writeFile(
      debug.promptLogPath,
      typeof textPart?.text === "string" ? textPart.text : "",
      "utf8",
    );
  }

  if (debug.inputPath) {
    await fs.writeFile(
      debug.inputPath,
      JSON.stringify(inputSnapshot ?? null, null, 2),
      "utf8",
    );
  }

  if (debug.outputPath) {
    await fs.writeFile(
      debug.outputPath,
      JSON.stringify(outputSnapshot ?? null, null, 2),
      "utf8",
    );
  }
};

