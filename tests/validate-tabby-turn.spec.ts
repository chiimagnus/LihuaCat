import test from "node:test";
import assert from "node:assert/strict";

import { validateTabbyTurnOutput } from "../src/domains/tabby/validate-tabby-turn.ts";

test("tabby-turn validation fails when required fields are missing", () => {
  const result = validateTabbyTurnOutput({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("say")));
  assert.ok(result.errors.some((error) => error.includes("done")));
  assert.ok(result.errors.some((error) => error.includes("options")));
  assert.ok(result.errors.some((error) => error.includes("internalNotes")));
});

test("done=false requires free_input option", () => {
  const result = validateTabbyTurnOutput({
    say: "你更接近哪一种感觉？",
    done: false,
    options: [
      { id: "a", label: "开心" },
      { id: "b", label: "释然" },
    ],
    internalNotes: "probe feelings",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("free_input")));
});

test("done=true requires fixed confirm/revise pair", () => {
  const result = validateTabbyTurnOutput({
    say: "我理解你想表达的是……",
    done: true,
    options: [
      { id: "confirm", label: "确认" },
      { id: "revise", label: "需要修改" },
    ],
    internalNotes: "confirm summary",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("fixed pair")));
});

test("valid done=false turn passes validation", () => {
  const result = validateTabbyTurnOutput({
    say: "你更接近哪一种感觉？",
    done: false,
    options: [
      { id: "gentle", label: "克制的温柔" },
      { id: "relief", label: "一种释然" },
      { id: "free_input", label: "我想自己说…" },
    ],
    internalNotes: "Need tone disambiguation.",
  });
  assert.equal(result.valid, true);
});

test("valid done=true confirm page passes validation", () => {
  const result = validateTabbyTurnOutput({
    say: "我理解你想表达的是：……",
    done: true,
    options: [
      { id: "confirm", label: "就是这个感觉" },
      { id: "revise", label: "需要修改" },
    ],
    internalNotes: "ready to confirm",
  });
  assert.equal(result.valid, true);
});
