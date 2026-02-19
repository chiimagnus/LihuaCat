import type { Thread } from "@openai/codex-sdk";

export type ModelReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type CodexLike = {
  startThread: (options?: {
    model?: string;
    modelReasoningEffort?: ModelReasoningEffort;
    workingDirectory?: string;
    skipGitRepoCheck?: boolean;
  }) => Pick<Thread, "run">;
};

export type CodexPromptPart =
  | { type: "text"; text: string }
  | { type: "local_image"; path: string };

export type CodexPromptInput = CodexPromptPart[];

export type LlmDebugArtifacts = {
  promptLogPath?: string;
  inputPath?: string;
  outputPath?: string;
};

