import type { StoryScript } from "../../contracts/story-script.types.ts";
import { validateStoryScriptStructure } from "./validate-story-script.ts";
import { validateStoryScriptSemantics } from "./validate-story-script.semantics.ts";
import type { StoryAgentClient } from "./story-agent.client.ts";

export type GenerateStoryScriptInput = {
  sourceDir: string;
  assets: Array<{ id: string; path: string }>;
  style: {
    preset: string;
    prompt?: string;
  };
  client: StoryAgentClient;
  maxRetries?: number;
  constraints?: {
    durationSec?: number;
    minDurationPerAssetSec?: number;
    requireAllAssetsUsed?: boolean;
  };
};

export type GenerateStoryScriptResult = {
  script: StoryScript;
  attempts: number;
};

export class StoryScriptGenerationFailedError extends Error {
  public readonly reasons: string[];
  public readonly attempts: number;

  constructor(attempts: number, reasons: string[]) {
    super(`Story script generation failed after ${attempts} attempts`);
    this.name = "StoryScriptGenerationFailedError";
    this.reasons = reasons;
    this.attempts = attempts;
  }
}

export const generateStoryScript = async ({
  sourceDir,
  assets,
  style,
  client,
  maxRetries = 2,
  constraints = {},
}: GenerateStoryScriptInput): Promise<GenerateStoryScriptResult> => {
  const durationSec = constraints.durationSec ?? 30;
  const minDurationPerAssetSec = constraints.minDurationPerAssetSec ?? 1;
  const requireAllAssetsUsed = constraints.requireAllAssetsUsed ?? true;

  const reasons: string[] = [];
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const candidate = await client.generateStoryScript({
        sourceDir,
        assets,
        style,
        constraints: {
          durationSec,
          minDurationPerAssetSec,
          requireAllAssetsUsed,
        },
        attempt,
        previousErrors: reasons,
      });

      const structure = validateStoryScriptStructure(candidate);
      if (!structure.valid || !structure.script) {
        reasons.push(...structure.errors.map((error) => `attempt ${attempt}: ${error}`));
        continue;
      }

      const semantic = validateStoryScriptSemantics(structure.script, {
        expectedDurationSec: durationSec,
        minDurationPerAssetSec,
        requireAllAssetsUsed,
      });
      if (!semantic.valid) {
        reasons.push(...semantic.errors.map((error) => `attempt ${attempt}: ${error}`));
        continue;
      }

      return {
        script: structure.script,
        attempts: attempt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reasons.push(`attempt ${attempt}: ${message}`);
    }
  }

  throw new StoryScriptGenerationFailedError(maxAttempts, reasons);
};
