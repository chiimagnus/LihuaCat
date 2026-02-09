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
  RenderMode,
  RunSummary,
  WorkflowProgressEvent,
} from "../../pipeline.ts";

export type RenderStoryTuiIntroInput = {
  useMockAgent: boolean;
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
};

export type RenderModeSelectionState = {
  lastFailure?: { mode: RenderMode; reason: string };
};

export type RenderStoryTui = {
  intro: (input: RenderStoryTuiIntroInput) => void;
  askSourceDir: (initialValue?: string) => Promise<string>;
  askStylePreset: (initialValue?: string) => Promise<string>;
  askPrompt: (initialValue?: string) => Promise<string>;
  chooseRenderMode: (state: RenderModeSelectionState) => Promise<RenderMode | "exit">;
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
      cancel("已取消操作");
      throw new TuiCancelledError();
    }
    return value;
  };

  return {
    intro(input) {
      intro("LihuaCat ▸ 创建故事视频");
      if (input.useMockAgent) {
        log.info("使用 mock agent（不调用 Codex）");
        return;
      }
      log.info(`Codex model: ${input.model} · reasoning: ${input.reasoningEffort}`);
    },

    async askSourceDir(initialValue) {
      const answer = mustContinue(
        await text({
          message: "素材目录路径",
          placeholder: "/ABS/PATH/TO/PHOTOS",
          initialValue,
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "目录路径不能为空";
            }
            return undefined;
          },
        }),
      );
      return answer.trim();
    },

    async askStylePreset(initialValue) {
      const options: Array<{
        value: string;
        label: string;
        hint: string;
      }> = [
        { value: "healing", label: "healing", hint: "温和治愈" },
        { value: "warm", label: "warm", hint: "暖色生活感" },
        { value: "cinematic", label: "cinematic", hint: "电影感叙事" },
        { value: "minimal", label: "minimal", hint: "克制简洁" },
        { value: "custom", label: "custom", hint: "自定义 preset" },
      ];
      const initial =
        initialValue && options.some((option) => option.value === initialValue)
          ? initialValue
          : "healing";

      const choice = mustContinue(
        await select({
          message: "选择风格 preset",
          initialValue: initial,
          options,
        }),
      );

      if (choice !== "custom") {
        return choice;
      }

      const custom = mustContinue(
        await text({
          message: "输入自定义 preset",
          initialValue:
            initialValue && !options.some((option) => option.value === initialValue)
              ? initialValue
              : undefined,
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "preset 不能为空";
            }
            return undefined;
          },
        }),
      );
      return custom.trim();
    },

    async askPrompt(initialValue) {
      const answer = mustContinue(
        await text({
          message: "补充描述（可留空）",
          placeholder: "例如：春天，慢节奏，治愈感",
          initialValue,
        }),
      );
      return answer.trim();
    },

    async chooseRenderMode({ lastFailure }) {
      if (lastFailure) {
        note(`mode: ${lastFailure.mode}\nreason: ${lastFailure.reason}`, "上一轮失败");
      }
      const mode = await select({
        message: "选择渲染模式",
        options: [
          { value: "template", label: "template", hint: "稳定、快速" },
          { value: "ai_code", label: "ai_code", hint: "可定制、可重试" },
          { value: "exit", label: "exit", hint: "退出本次流程" },
        ],
      });
      if (isCancel(mode)) {
        return "exit";
      }
      return mode;
    },

    onWorkflowProgress(event) {
      if (event.stage.endsWith("_start")) {
        if (hasActiveSpinner) {
          status.stop();
        }
        status.start(`● ${event.message}`);
        hasActiveSpinner = true;
        return;
      }

      if (event.stage === "choose_mode") {
        stopSpinnerIfNeeded();
        log.step(`▸ ${event.message}`);
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
      outro("✓ 视频生成成功");
      note(
        [
          `mode: ${summary.mode}`,
          `video: ${summary.videoPath}`,
          `script: ${summary.storyScriptPath}`,
          `runLog: ${summary.runLogPath}`,
          summary.errorLogPath ? `errorLog: ${summary.errorLogPath}` : "",
          summary.generatedCodePath ? `generatedCode: ${summary.generatedCodePath}` : "",
        ]
          .filter((line) => line.length > 0)
          .join("\n"),
        "产物路径",
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
