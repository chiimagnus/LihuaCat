import path from "node:path";
import { listAvailableBrowserExecutables } from "../domains/template-render/browser-locator.ts";

import { createStoryVideoFlow } from "../flows/create-story-video/create-story-video.flow.ts";
import {
  createCodexLynxAgentClient,
  createCodexOcelotAgentClient,
  createCodexStoryBriefAgentClient,
  createCodexTabbyAgentClient,
  DEFAULT_CODEX_MODEL,
  DEFAULT_CODEX_REASONING_EFFORT,
  runStoryWorkflowV2,
  SourceDirectoryNotFoundError,
  StoryBriefGenerationFailedError,
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
  workflowImpl?: typeof runStoryWorkflowV2;
  tui?: RenderStoryTui;
  isInteractiveTerminal?: () => boolean;
  listAvailableBrowsersImpl?: typeof listAvailableBrowserExecutables;
};

export const runRenderStoryCommand = async ({
  argv,
  stderr = process.stderr,
  workflowImpl = runStoryWorkflowV2,
  tui,
  isInteractiveTerminal = () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
  listAvailableBrowsersImpl = listAvailableBrowserExecutables,
}: RunRenderStoryCommandInput): Promise<number> => {
  const args = parseArgs(argv);
  const model = args.get("model") ?? DEFAULT_CODEX_MODEL;
  const modelReasoningEffort = parseModelReasoningEffort(
    args.get("model-reasoning-effort"),
  );
  const resolvedReasoningEffort = modelReasoningEffort ?? DEFAULT_CODEX_REASONING_EFFORT;
  let browserExecutablePath = args.get("browser-executable")
    ? path.resolve(args.get("browser-executable")!)
    : undefined;
  const sourceDirInitial = args.get("input");

  if (!tui && !isInteractiveTerminal()) {
    stderr.write(
      "Interactive TUI requires a TTY terminal. Please run this command directly in a terminal session.\n",
    );
    return 1;
  }

  const ui = tui ?? createClackRenderStoryTui();
  const tabbyAgentClient = createCodexTabbyAgentClient({
    model,
    modelReasoningEffort: resolvedReasoningEffort,
    workingDirectory: process.cwd(),
  });
  const storyBriefAgentClient = createCodexStoryBriefAgentClient({
    model,
    modelReasoningEffort: resolvedReasoningEffort,
    workingDirectory: process.cwd(),
  });
  const ocelotAgentClient = createCodexOcelotAgentClient({
    model,
    modelReasoningEffort: resolvedReasoningEffort,
    workingDirectory: process.cwd(),
  });
  const lynxAgentClient = createCodexLynxAgentClient({
    model,
    modelReasoningEffort: resolvedReasoningEffort,
    workingDirectory: process.cwd(),
  });

  ui.intro({
    model,
    reasoningEffort: resolvedReasoningEffort,
  });

  if (!browserExecutablePath && ui.askBrowserExecutable) {
    const detectedBrowsers = await listAvailableBrowsersImpl();
    const selectedPath = await ui.askBrowserExecutable({ candidates: detectedBrowsers });
    browserExecutablePath = path.resolve(selectedPath);
  }

  try {
    const summary = await createStoryVideoFlow({
      prompts: {
        askSourceDir: async () =>
          resolveInputPath(sourceDirInitial ?? (await ui.askSourceDir())),
      },
      tabbyAgentClient,
      tabbyTui: {
        onTurnStart: ui.tabbyOnTurnStart,
        onTurnDone: ui.tabbyOnTurnDone,
        chooseOption: ui.tabbyChooseOption,
        askFreeInput: ui.tabbyAskFreeInput,
      },
      storyBriefAgentClient,
      ocelotAgentClient,
      lynxAgentClient,
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
      StoryBriefGenerationFailedErrorClass: StoryBriefGenerationFailedError,
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
