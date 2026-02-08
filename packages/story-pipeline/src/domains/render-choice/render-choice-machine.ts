export type RenderMode = "template" | "ai_code";

export type RenderChoiceState =
  | {
      phase: "select_mode";
      lastFailure?: {
        mode: RenderMode;
        reason: string;
      };
    }
  | {
      phase: "rendering";
      mode: RenderMode;
    }
  | {
      phase: "completed";
      mode: RenderMode;
      videoPath: string;
    };

export class RenderChoiceMachine {
  private state: RenderChoiceState = { phase: "select_mode" };

  getState(): RenderChoiceState {
    return this.state;
  }

  selectMode(mode: RenderMode): RenderChoiceState {
    if (this.state.phase !== "select_mode") {
      throw new Error("mode can only be selected from select_mode state");
    }
    this.state = { phase: "rendering", mode };
    return this.state;
  }

  markFailure(reason: string): RenderChoiceState {
    if (this.state.phase !== "rendering") {
      throw new Error("failure can only be reported while rendering");
    }
    const failedMode = this.state.mode;
    this.state = {
      phase: "select_mode",
      lastFailure: {
        mode: failedMode,
        reason,
      },
    };
    return this.state;
  }

  markSuccess(videoPath: string): RenderChoiceState {
    if (this.state.phase !== "rendering") {
      throw new Error("success can only be reported while rendering");
    }
    this.state = {
      phase: "completed",
      mode: this.state.mode,
      videoPath,
    };
    return this.state;
  }
}
