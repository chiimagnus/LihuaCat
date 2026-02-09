import path from "node:path";
import { createInterface } from "node:readline/promises";

import { createStoryVideoFlow } from "../flows/create-story-video/create-story-video.flow.ts";
import {
  createCodexStoryAgentClient,
  type StoryAgentClient,
} from "../../../story-pipeline/src/domains/story-script/story-agent.client.ts";
import { StoryScriptGenerationFailedError } from "../../../story-pipeline/src/domains/story-script/generate-story-script.ts";
import { runStoryWorkflow } from "../../../story-pipeline/src/workflow/start-story-run.ts";
import type { RenderMode } from "../../../story-pipeline/src/domains/render-choice/render-choice-machine.ts";

type LogWriter = {
  write: (chunk: string) => void;
};

type PromptSession = {
  askSourceDir: () => Promise<string>;
  askStylePreset: () => Promise<string>;
  askPrompt: () => Promise<string>;
  askRenderMode: (state: { lastFailure?: { mode: RenderMode; reason: string } }) => Promise<RenderMode | "exit">;
  close: () => void;
};

export type RunRenderStoryCommandInput = {
  argv: string[];
  stdout?: LogWriter;
  stderr?: LogWriter;
  workflowImpl?: typeof runStoryWorkflow;
};

export const runRenderStoryCommand = async ({
  argv,
  stdout = process.stdout,
  stderr = process.stderr,
  workflowImpl = runStoryWorkflow,
}: RunRenderStoryCommandInput): Promise<number> => {
  const args = parseArgs(argv);
  const modeSequence = parseModeSequence(args.get("mode-sequence") ?? args.get("mode") ?? "");
  const model = args.get("model");
  const browserExecutablePath = args.get("browser-executable")
    ? path.resolve(args.get("browser-executable")!)
    : undefined;
  const storyAgentClient: StoryAgentClient = args.has("mock-agent")
    ? createMockStoryAgentClient()
    : createCodexStoryAgentClient({
      model,
      workingDirectory: process.cwd(),
    });

  const promptSession = createPromptSession({ stdout, stderr, args });

  try {
    const summary = await createStoryVideoFlow({
      prompts: {
        askSourceDir: promptSession.askSourceDir,
        askStylePreset: promptSession.askStylePreset,
        askPrompt: promptSession.askPrompt,
        chooseRenderMode: async (state) => {
          const next = modeSequence.shift();
          if (next) {
            return next;
          }
          if (!process.stdin.isTTY) {
            return "exit";
          }
          return promptSession.askRenderMode(state);
        },
      },
      storyAgentClient,
      browserExecutablePath,
      workflowImpl,
    });

    stdout.write("Story video generated successfully.\n");
    stdout.write(`mode: ${summary.mode}\n`);
    stdout.write(`videoPath: ${summary.videoPath}\n`);
    stdout.write(`storyScriptPath: ${summary.storyScriptPath}\n`);
    stdout.write(`runLogPath: ${summary.runLogPath}\n`);
    if (summary.errorLogPath) {
      stdout.write(`errorLogPath: ${summary.errorLogPath}\n`);
    }
    if (summary.generatedCodePath) {
      stdout.write(`generatedCodePath: ${summary.generatedCodePath}\n`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    stderr.write(`Render failed: ${message}\n`);
    if (error instanceof StoryScriptGenerationFailedError && error.reasons.length > 0) {
      stderr.write("Story script generation failure details:\n");
      for (const reason of error.reasons) {
        stderr.write(`- ${reason}\n`);
      }
    }
    if (stack) {
      stderr.write(`${stack}\n`);
    }
    return 1;
  } finally {
    promptSession.close();
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

const createPromptSession = ({
  stdout,
  stderr,
  args,
}: {
  stdout: LogWriter;
  stderr: LogWriter;
  args: Map<string, string>;
}): PromptSession => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ensureInteractive = () => {
    if (process.stdin.isTTY) {
      return;
    }
    throw new Error("Missing required CLI options in non-interactive mode. Provide --input/--style/--mode.");
  };

  const askNonEmpty = async (question: string): Promise<string> => {
    while (true) {
      const answer = (await rl.question(question)).trim();
      if (answer.length > 0) {
        return answer;
      }
      stderr.write("Input cannot be empty. Please retry.\n");
    }
  };

  const askSourceDir = async (): Promise<string> => {
    const fromArgs = args.get("input");
    if (fromArgs) {
      return resolveInputPath(fromArgs);
    }
    ensureInteractive();
    const answer = await askNonEmpty("图片目录路径（--input）: ");
    return resolveInputPath(answer);
  };

  const askStylePreset = async (): Promise<string> => {
    const fromArgs = args.get("style");
    if (fromArgs && fromArgs.trim().length > 0) {
      return fromArgs.trim();
    }
    if (!process.stdin.isTTY) {
      return "healing";
    }
    ensureInteractive();
    return askNonEmpty("风格 preset（如 healing）: ");
  };

  const askPrompt = async (): Promise<string> => {
    const fromArgs = args.get("prompt");
    if (fromArgs !== undefined) {
      return fromArgs;
    }
    if (!process.stdin.isTTY) {
      return "";
    }
    ensureInteractive();
    return rl.question("补充描述（可留空）: ");
  };

  const askRenderMode = async ({
    lastFailure,
  }: {
    lastFailure?: { mode: RenderMode; reason: string };
  }): Promise<RenderMode | "exit"> => {
    ensureInteractive();
    if (lastFailure) {
      stdout.write(
        `上一轮失败 mode=${lastFailure.mode}\nreason=${lastFailure.reason}\n`,
      );
    }
    while (true) {
      const answer = (await rl.question("请选择渲染模式（template / ai_code / exit）: "))
        .trim()
        .toLowerCase();
      if (answer === "template" || answer === "ai_code" || answer === "exit") {
        return answer;
      }
      stderr.write("无效输入，请输入 template、ai_code 或 exit。\n");
    }
  };

  return {
    askSourceDir,
    askStylePreset,
    askPrompt,
    askRenderMode,
    close: () => rl.close(),
  };
};

const createMockStoryAgentClient = (): StoryAgentClient => {
  return {
    async generateStoryScript(request) {
      const assetCount = request.assets.length;
      const base = Math.floor(request.constraints.durationSec / assetCount);
      const remainder = request.constraints.durationSec - base * assetCount;

      let cursor = 0;
      const timeline = request.assets.map((asset, index) => {
        const extra = index === request.assets.length - 1 ? remainder : 0;
        const duration = base + extra;
        const item = {
          assetId: asset.id,
          startSec: cursor,
          endSec: cursor + duration,
          subtitleId: `sub_${String(index + 1).padStart(3, "0")}`,
        };
        cursor += duration;
        return item;
      });

      const subtitles = timeline.map((item, index) => ({
        id: item.subtitleId,
        text: `Scene ${index + 1} in ${request.style.preset} style`,
        startSec: item.startSec,
        endSec: item.endSec,
      }));

      return {
        version: "1.0",
        input: {
          sourceDir: request.sourceDir,
          imageCount: assetCount,
          assets: request.assets,
        },
        video: {
          width: 1080,
          height: 1920,
          fps: 30,
          durationSec: request.constraints.durationSec,
        },
        style: request.style,
        timeline,
        subtitles,
      };
    },
  };
};
