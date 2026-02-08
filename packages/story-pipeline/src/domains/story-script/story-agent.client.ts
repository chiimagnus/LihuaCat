import type { StoryScript } from "../../contracts/story-script.types.ts";

export type GenerateStoryScriptRequest = {
  sourceDir: string;
  assets: Array<{
    id: string;
    path: string;
  }>;
  style: {
    preset: string;
    prompt?: string;
  };
  constraints: {
    durationSec: number;
    minDurationPerAssetSec: number;
    requireAllAssetsUsed: boolean;
  };
  attempt: number;
  previousErrors: string[];
};

export interface StoryAgentClient {
  generateStoryScript(request: GenerateStoryScriptRequest): Promise<unknown>;
}

export class StoryAgentNotConfiguredError extends Error {
  constructor() {
    super("Story agent client is not configured");
    this.name = "StoryAgentNotConfiguredError";
  }
}

export class NullStoryAgentClient implements StoryAgentClient {
  async generateStoryScript(_request: GenerateStoryScriptRequest): Promise<StoryScript> {
    throw new StoryAgentNotConfiguredError();
  }
}
