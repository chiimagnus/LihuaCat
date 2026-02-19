import { createCodexJsonRunner, type CodexLike, type ModelReasoningEffort } from "../../tools/llm/index.ts";
import { buildStoryBriefPromptInput } from "./story-brief.prompt.ts";
import { storyBriefOutputSchema } from "./story-brief.schema.ts";
import type { TabbyConversationEvent } from "../../contracts/tabby-conversation.types.ts";

export type GenerateStoryBriefRequest = {
  photos: Array<{ photoRef: string; path: string }>;
  conversation: TabbyConversationEvent[];
  confirmedSummary: string;
  attempt: number;
  previousErrors: string[];
};

export interface StoryBriefAgentClient {
  generateStoryBrief(request: GenerateStoryBriefRequest): Promise<unknown>;
}

export type CreateCodexStoryBriefAgentClientInput = {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  workingDirectory?: string;
  codexFactory?: () => CodexLike;
  assertAuthenticated?: () => Promise<void>;
};

export const DEFAULT_STORY_BRIEF_CODEX_MODEL = "gpt-5.1-codex-mini";
export const DEFAULT_STORY_BRIEF_CODEX_REASONING_EFFORT = "medium" as const;

export class StoryBriefAgentResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryBriefAgentResponseParseError";
  }
}

export const createCodexStoryBriefAgentClient = ({
  model = DEFAULT_STORY_BRIEF_CODEX_MODEL,
  modelReasoningEffort = DEFAULT_STORY_BRIEF_CODEX_REASONING_EFFORT,
  workingDirectory,
  codexFactory,
  assertAuthenticated = async () => {
    return;
  },
}: CreateCodexStoryBriefAgentClientInput = {}): StoryBriefAgentClient => {
  const runner = createCodexJsonRunner({
    model,
    modelReasoningEffort,
    workingDirectory,
    codexFactory,
  });

  return {
    async generateStoryBrief(request: GenerateStoryBriefRequest): Promise<unknown> {
      await assertAuthenticated();
      try {
        return await runner.runJson(buildStoryBriefPromptInput(request), {
          outputSchema: storyBriefOutputSchema,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new StoryBriefAgentResponseParseError(message);
      }
    },
  };
};
