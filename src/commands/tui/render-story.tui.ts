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

export type RenderStoryTuiIntroInput = {
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
};

export type RenderStoryTui = {
  intro: (input: RenderStoryTuiIntroInput) => void;
  askSourceDir: () => Promise<string>;
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

  const mustContinue = <T>(value: T | symbol): T => {
    if (isCancel(value)) {
      cancel("Operation cancelled.");
      throw new TuiCancelledError();
    }
    return value;
  };

  return {
    intro(input) {
      intro("LihuaCat ▸ Create story video");
      log.info(`Codex model: ${input.model} · reasoning: ${input.reasoningEffort}`);
    },

    async askSourceDir() {
      const answer = mustContinue(
        await text({
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

    async tabbyChooseOption({ say, options, done, reviseDisabled }) {
      stopSpinnerIfNeeded();
      note(say, "🐱 Tabby");
      if (done && reviseDisabled) {
        log.message("  (已达到最大修改次数，不能再“需要修改”)");
      }

      const choice = mustContinue(
        await select({
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
      const answer = mustContinue(
        await text({
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
