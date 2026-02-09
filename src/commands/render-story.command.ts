import path from "node:path";

import { createStoryVideoFlow } from "../flows/create-story-video/create-story-video.flow.ts";
import {
  createCodexStoryAgentClient,
  DEFAULT_CODEX_MODEL,
  DEFAULT_CODEX_REASONING_EFFORT,
  runStoryWorkflow,
  SourceDirectoryNotFoundError,
  StoryScriptGenerationFailedError,
  type RenderMode,
} from "../pipeline.ts";
import { buildRenderFailureOutput } from "./render-story.error-mapper.ts";
import {
  createClackRenderStoryTui,
  type RenderStoryTui,
  TuiCancelledError,
} from "./tui/render-story.tui.ts";

type LogWriter = {
  write: (chunk: string) => void;
};

export type RunRenderStoryCommandInput = {
  argv: string[];
  stderr?: LogWriter;
  workflowImpl?: typeof runStoryWorkflow;
  tui?: RenderStoryTui;
  isInteractiveTerminal?: () => boolean;
};

export const runRenderStoryCommand = async ({
  argv,
  stderr = process.stderr,
  workflowImpl = runStoryWorkflow,
  tui,
  isInteractiveTerminal = () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
}: RunRenderStoryCommandInput): Promise<number> => {
  const args = parseArgs(argv);
  const modeSequence = parseModeSequence(args.get("mode-sequence") ?? args.get("mode") ?? "");
  const model = args.get("model") ?? DEFAULT_CODEX_MODEL;
  const modelReasoningEffort = parseModelReasoningEffort(
    args.get("model-reasoning-effort"),
  );
  const resolvedReasoningEffort = modelReasoningEffort ?? DEFAULT_CODEX_REASONING_EFFORT;
  const browserExecutablePath = args.get("browser-executable")
    ? path.resolve(args.get("browser-executable")!)
    : undefined;
  const sourceDirInitial = args.get("input");
  const styleInitial = args.get("style");
  const promptInitial = args.get("prompt");

  if (!tui && !isInteractiveTerminal()) {
    stderr.write(
      "Interactive TUI requires a TTY terminal. Please run this command directly in a terminal session.\n",
    );
    return 1;
  }

  const ui = tui ?? createClackRenderStoryTui();
  const storyAgentClient = createCodexStoryAgentClient({
    model,
    modelReasoningEffort: resolvedReasoningEffort,
    workingDirectory: process.cwd(),
  });

  ui.intro({
    model,
    reasoningEffort: resolvedReasoningEffort,
  });

  try {
    const summary = await createStoryVideoFlow({
      prompts: {
        askSourceDir: async () =>
          resolveInputPath(sourceDirInitial ?? (await ui.askSourceDir())),
        askStylePreset: async () => {
          if (styleInitial && styleInitial.trim().length > 0) {
            return styleInitial.trim();
          }
          return ui.askStylePreset();
        },
        askPrompt: async () => {
          if (promptInitial !== undefined) {
            return promptInitial;
          }
          return ui.askPrompt();
        },
        chooseRenderMode: async (state) => {
          const next = modeSequence.shift();
          if (next) {
            return next;
          }
          return ui.chooseRenderMode(state);
        },
      },
      storyAgentClient,
      browserExecutablePath,
      onProgress: (event) => ui.onWorkflowProgress(event),
      workflowImpl,
    });

    ui.complete(summary);
    return 0;
  } catch (error) {
    if (error instanceof TuiCancelledError) {
      ui.fail([error.message]);
      return 1;
    }
    const output = buildRenderFailureOutput({
      error,
      SourceDirectoryNotFoundErrorClass: SourceDirectoryNotFoundError,
      StoryScriptGenerationFailedErrorClass: StoryScriptGenerationFailedError,
    });
    ui.fail(output.lines);
    return 1;
  } finally {
    ui.close();
  }
};

const parseArgs = (argv: string[]): Map<string, string> => {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    i += 1;
  }
  return args;
};

const parseModeSequence = (raw: string): RenderMode[] => {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is RenderMode => item === "template" || item === "ai_code");
};

const parseModelReasoningEffort = (
  raw: string | undefined,
): "minimal" | "low" | "medium" | "high" | "xhigh" | undefined => {
  if (!raw) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
  ) {
    return normalized;
  }
  return undefined;
};

const resolveInputPath = (input: string): string => {
  if (path.isAbsolute(input)) {
    return input;
  }
  const initCwd = process.env.INIT_CWD;
  if (initCwd) {
    return path.resolve(initCwd, input);
  }
  return path.resolve(process.cwd(), input);
};
