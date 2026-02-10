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
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
};

export type RenderModeSelectionState = {
  lastFailure?: { mode: RenderMode; reason: string };
};

export type RenderStoryTui = {
  intro: (input: RenderStoryTuiIntroInput) => void;
  askSourceDir: () => Promise<string>;
  askStylePreset: () => Promise<string>;
  askPrompt: () => Promise<string>;
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

    async askStylePreset() {
      const options: Array<{
        value: string;
        label: string;
        hint: string;
      }> = [
        { value: "healing", label: "healing", hint: "Soft, healing" },
        { value: "warm", label: "warm", hint: "Warm lifestyle" },
        { value: "cinematic", label: "cinematic", hint: "Cinematic narration" },
        { value: "minimal", label: "minimal", hint: "Minimal and restrained" },
        { value: "custom", label: "custom", hint: "Custom preset" },
      ];
      const choice = mustContinue(
        await select({
          message: "Select style preset",
          initialValue: "healing",
          options,
        }),
      );

      if (choice !== "custom") {
        return choice;
      }

      const custom = mustContinue(
        await text({
          message: "Enter custom preset",
          validate(value) {
            if (!value || value.trim().length === 0) {
              return "Preset cannot be empty.";
            }
            return undefined;
          },
        }),
      );
      return custom.trim();
    },

    async askPrompt() {
      const answer = mustContinue(
        await text({
          message: "Extra description (optional)",
          placeholder: "e.g. spring, slow pace, healing vibe",
        }),
      );
      return answer.trim();
    },

    async chooseRenderMode({ lastFailure }) {
      if (lastFailure) {
        note(
          `mode: ${lastFailure.mode}\nreason: ${lastFailure.reason}`,
          "Last attempt failed",
        );
      }
      const mode = await select({
        message: "Select render mode",
        options: [
          { value: "template", label: "template", hint: "Stable, fast" },
          { value: "ai_code", label: "ai_code", hint: "Customizable, retryable" },
          { value: "exit", label: "exit", hint: "Exit this run" },
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
      outro("✓ Video created");
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
