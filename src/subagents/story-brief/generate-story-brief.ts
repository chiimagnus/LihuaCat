import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { TabbyConversationEvent } from "../../contracts/tabby-conversation.types.ts";
import type { StoryBriefAgentClient } from "./story-brief.client.ts";
import { validateStoryBriefStructure } from "./validate-story-brief.ts";

export type GenerateStoryBriefInput = {
  photos: Array<{ photoRef: string; path: string }>;
  conversation: TabbyConversationEvent[];
  confirmedSummary: string;
  client: StoryBriefAgentClient;
  maxRetries?: number;
};

export type GenerateStoryBriefResult = {
  brief: StoryBrief;
  attempts: number;
};

export class StoryBriefGenerationFailedError extends Error {
  public readonly reasons: string[];
  public readonly attempts: number;

  constructor(attempts: number, reasons: string[]) {
    super(`StoryBrief generation failed after ${attempts} attempts`);
    this.name = "StoryBriefGenerationFailedError";
    this.reasons = reasons;
    this.attempts = attempts;
  }
}

export const generateStoryBrief = async ({
  photos,
  conversation,
  confirmedSummary,
  client,
  maxRetries = 2,
}: GenerateStoryBriefInput): Promise<GenerateStoryBriefResult> => {
  const reasons: string[] = [];
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const candidate = await client.generateStoryBrief({
        photos,
        conversation,
        confirmedSummary,
        attempt,
        previousErrors: reasons,
      });

      const structure = validateStoryBriefStructure(candidate, {
        expectedPhotoCount: photos.length,
      });
      if (!structure.valid || !structure.brief) {
        reasons.push(...structure.errors.map((error) => `attempt ${attempt}: ${error}`));
        continue;
      }

      return {
        brief: structure.brief,
        attempts: attempt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reasons.push(`attempt ${attempt}: ${message}`);
    }
  }

  throw new StoryBriefGenerationFailedError(maxAttempts, reasons);
};

