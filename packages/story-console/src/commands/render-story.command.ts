import { createStoryVideoFlow } from "../flows/create-story-video/create-story-video.flow.ts";
import {
  createCodexStoryAgentClient,
  type StoryAgentClient,
} from "../../../story-pipeline/src/domains/story-script/story-agent.client.ts";
import { runStoryWorkflow } from "../../../story-pipeline/src/workflow/start-story-run.ts";
import type { RenderMode } from "../../../story-pipeline/src/domains/render-choice/render-choice-machine.ts";
import path from "node:path";

type LogWriter = {
  write: (chunk: string) => void;
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
  const inputDir = args.get("input");
  if (!inputDir) {
    stderr.write("Missing required option: --input <photos-dir>\n");
    return 1;
  }
  const resolvedInputDir = resolveInputPath(inputDir);

  const style = args.get("style") ?? "healing";
  const prompt = args.get("prompt") ?? "";
  const modeSequence = parseModeSequence(args.get("mode-sequence") ?? args.get("mode") ?? "template");
  const model = args.get("model");
  const storyAgentClient: StoryAgentClient = args.has("mock-agent")
    ? createMockStoryAgentClient()
    : createCodexStoryAgentClient({
      model,
      workingDirectory: process.cwd(),
    });

  try {
    const summary = await createStoryVideoFlow({
      prompts: {
        askSourceDir: async () => resolvedInputDir,
        askStylePreset: async () => style,
        askPrompt: async () => prompt,
        chooseRenderMode: async () => modeSequence.shift() ?? "exit",
      },
      storyAgentClient,
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
    if (stack) {
      stderr.write(`${stack}\n`);
    }
    return 1;
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
