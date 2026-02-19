import {
  cancel,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";

import type {
  RunSummary,
  WorkflowProgressEvent,
} from "../../pipeline.ts";
import type { TabbyOption } from "../../contracts/tabby-turn.types.ts";
import type { BrowserCandidate } from "../../tools/render/browser-locator.ts";

export type RenderStoryTuiIntroInput = {
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
};

export type RenderStoryTui = {
  intro: (input: RenderStoryTuiIntroInput) => void;
  askSourceDir: () => Promise<string>;
  askBrowserExecutable?: (input: {
    candidates: BrowserCandidate[];
  }) => Promise<string>;
  tabbyOnTurnStart?: (input: {
    turn: number;
    phase: "start" | "chat" | "revise";
  }) => void;
  tabbyOnTurnDone?: () => void;
  tabbyChooseOption: (input: {
    say: string;
    options: TabbyOption[];
    done: boolean;
    reviseDisabled: boolean;
  }) => Promise<TabbyOption>;
  tabbyAskFreeInput: (input: { message: string }) => Promise<string>;
  onWorkflowProgress: (event: WorkflowProgressEvent) => void;
  complete: (summary: RunSummary) => void;
  fail: (lines: string[]) => void;
  close: () => void;
};

export class TuiCancelledError extends Error {
  constructor() {
    super("Operation cancelled by user.");
    this.name = "TuiCancelledError";
  }
}

export const createClackRenderStoryTui = (): RenderStoryTui => {
  const status = spinner();
  let hasActiveSpinner = false;

  const stopSpinnerIfNeeded = () => {
    if (!hasActiveSpinner) {
      return;
    }
    status.stop();
    hasActiveSpinner = false;
  };

  const promptWithCancelGuard = async <T>(
    runPrompt: () => Promise<T | symbol>,
  ): Promise<T> => {
    while (true) {
      const value = await runPrompt();
      if (!isCancel(value)) {
        return value;
      }

      stopSpinnerIfNeeded();
      const decision = await select({
        message: "检测到 Esc，是否退出当前流程？",
        options: [
          { value: "continue", label: "继续操作" },
          { value: "exit", label: "退出" },
        ],
      });
      if (isCancel(decision) || decision === "exit") {
        cancel("Operation cancelled.");
        throw new TuiCancelledError();
      }
    }
  };

  return {
    intro(input) {
      intro("LihuaCat ▸ Create story video");
      log.info(`Codex model: ${input.model} · reasoning: ${input.reasoningEffort}`);
    },

    async askSourceDir() {
      const answer = await promptWithCancelGuard(
        () => text({
          message: "Source directory",
          placeholder: "/ABS/PATH/TO/PHOTOS",
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "Directory path cannot be empty.";
            }
            return undefined;
          },
        }),
      );
      return answer.trim();
    },

    async askBrowserExecutable({ candidates }) {
      stopSpinnerIfNeeded();
      const options = [
        ...candidates.map((candidate) => ({
          value: candidate.executablePath,
          label: `${toBrowserLabel(candidate.browser)} (${candidate.executablePath})`,
        })),
        {
          value: "__manual__",
          label: "手动输入浏览器可执行文件路径",
        },
      ];
      const selected = await promptWithCancelGuard(
        () => select({
          message: "选择用于渲染的浏览器",
          options,
        }),
      );
      if (selected !== "__manual__") {
        return selected;
      }
      const manualPath = await promptWithCancelGuard(
        () => text({
          message: "Browser executable path",
          placeholder: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "Executable path cannot be empty.";
            }
            return undefined;
          },
        }),
      );
      return manualPath.trim();
    },

    tabbyOnTurnStart({ turn }) {
      if (hasActiveSpinner) {
        status.stop();
      }
      status.start(`🐱 Tabby thinking... (turn ${turn})`);
      hasActiveSpinner = true;
    },

    tabbyOnTurnDone() {
      // Spinner is intentionally stopped when user-facing output is shown.
    },

    async tabbyChooseOption({ say, options, done, reviseDisabled }) {
      stopSpinnerIfNeeded();
      note(say, "🐱 Tabby");
      if (done && reviseDisabled) {
        log.message("  (已达到最大修改次数，不能再“需要修改”)");
      }

      const choice = await promptWithCancelGuard(
        () => select({
          message: done ? "确认一下这个感觉？" : "你更接近哪一句？",
          options: options.map((option) => ({
            value: option.id,
            label: option.label,
          })),
        }),
      );

      const selected = options.find((option) => option.id === choice);
      if (!selected) {
        throw new Error("Unexpected selection: option not found");
      }
      return selected;
    },

    async tabbyAskFreeInput({ message }) {
      stopSpinnerIfNeeded();
      const answer = await promptWithCancelGuard(
        () => text({
          message,
          placeholder: "一句话也可以",
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "Text cannot be empty.";
            }
            return undefined;
          },
        }),
      );
      return answer.trim();
    },

    onWorkflowProgress(event) {
      if (event.stage === "tabby_start") {
        stopSpinnerIfNeeded();
        log.step(`▸ ${event.message}`);
        return;
      }

      if (event.stage.endsWith("_progress")) {
        const message = `● ${event.message}`;
        if (hasActiveSpinner) {
          status.message(message);
          return;
        }
        status.start(message);
        hasActiveSpinner = true;
        return;
      }

      if (event.stage.endsWith("_start")) {
        if (hasActiveSpinner) {
          status.stop();
        }
        status.start(`● ${event.message}`);
        hasActiveSpinner = true;
        return;
      }

      if (event.stage === "render_failed") {
        if (hasActiveSpinner) {
          status.error(`✗ ${event.message}`);
          hasActiveSpinner = false;
          return;
        }
        log.error(`✗ ${event.message}`);
        return;
      }

      if (event.stage.endsWith("_done") || event.stage.endsWith("_success")) {
        if (hasActiveSpinner) {
          status.stop(`✓ ${event.message}`);
          hasActiveSpinner = false;
          return;
        }
        log.success(`✓ ${event.message}`);
      }
    },

    complete(summary) {
      stopSpinnerIfNeeded();
      outro("✓ Video created");
      note(
        [
          `mode: ${summary.mode}`,
          `video: ${summary.videoPath}`,
          `storyBrief: ${summary.storyBriefPath}`,
          `renderScript: ${summary.renderScriptPath}`,
          `tabbyConversation: ${summary.tabbyConversationPath}`,
          `runLog: ${summary.runLogPath}`,
          summary.errorLogPath ? `errorLog: ${summary.errorLogPath}` : "",
          `ocelotInput: ${summary.ocelotInputPath}`,
          `ocelotOutput: ${summary.ocelotOutputPath}`,
          `ocelotPrompt: ${summary.ocelotPromptLogPath}`,
          summary.ocelotRevisionPaths.length > 0
            ? `ocelotRevisions:\n${summary.ocelotRevisionPaths.map((p) => `- ${p}`).join("\n")}`
            : "",
          summary.lynxReviewPaths.length > 0
            ? `lynxReviews:\n${summary.lynxReviewPaths.map((p) => `- ${p}`).join("\n")}`
            : "",
          summary.lynxPromptLogPaths.length > 0
            ? `lynxPrompts:\n${summary.lynxPromptLogPaths.map((p) => `- ${p}`).join("\n")}`
            : "",
        ]
          .filter((line) => line.length > 0)
          .join("\n"),
        "Artifact paths",
      );
    },

    fail(lines) {
      stopSpinnerIfNeeded();
      const [headline, ...rest] = lines;
      if (headline) {
        log.error(headline);
      }
      for (const line of rest) {
        log.message(`  ${line}`);
      }
    },

    close() {
      stopSpinnerIfNeeded();
    },
  };
};

const toBrowserLabel = (browser: BrowserCandidate["browser"]): string => {
  if (browser === "chrome") return "Google Chrome";
  if (browser === "edge") return "Microsoft Edge";
  return "Brave";
};
