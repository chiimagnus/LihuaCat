import test from "node:test";
import assert from "node:assert/strict";

import { RenderChoiceMachine } from "./render-choice-machine.ts";

test("each round starts with selecting a render mode", () => {
  const machine = new RenderChoiceMachine();
  assert.equal(machine.getState().phase, "select_mode");
  machine.selectMode("template");
  assert.deepEqual(machine.getState(), {
    phase: "rendering",
    mode: "template",
  });
});

test("ai code render failure returns to selection menu", () => {
  const machine = new RenderChoiceMachine();
  machine.selectMode("ai_code");
  const state = machine.markFailure("compile failed");
  assert.equal(state.phase, "select_mode");
  if (state.phase === "select_mode") {
    assert.equal(state.lastFailure?.mode, "ai_code");
    assert.equal(state.lastFailure?.reason, "compile failed");
  }
});

test("template render failure returns to selection menu", () => {
  const machine = new RenderChoiceMachine();
  machine.selectMode("template");
  const state = machine.markFailure("render failed");
  assert.equal(state.phase, "select_mode");
  if (state.phase === "select_mode") {
    assert.equal(state.lastFailure?.mode, "template");
  }
});

test("successful render completes the flow", () => {
  const machine = new RenderChoiceMachine();
  machine.selectMode("template");
  const state = machine.markSuccess("/tmp/video.mp4");
  assert.deepEqual(state, {
    phase: "completed",
    mode: "template",
    videoPath: "/tmp/video.mp4",
  });
});
