import test from "node:test";
import assert from "node:assert/strict";

import { validateLynxReviewStructure } from "../src/domains/lynx/validate-lynx-review.ts";

test("validateLynxReviewStructure accepts a minimal valid review", () => {
  const result = validateLynxReviewStructure({
    passed: true,
    summary: "OK",
    issues: [],
    requiredChanges: [],
  });
  assert.equal(result.valid, true);
  assert.ok(result.review);
  assert.equal(result.review.passed, true);
});

test("validateLynxReviewStructure rejects non-object input", () => {
  const result = validateLynxReviewStructure("nope");
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("validateLynxReviewStructure rejects missing passed", () => {
  const result = validateLynxReviewStructure({
    summary: "OK",
    issues: [],
    requiredChanges: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("passed")));
});

test("validateLynxReviewStructure rejects invalid issue entries", () => {
  const result = validateLynxReviewStructure({
    passed: false,
    summary: "Need changes",
    issues: [{ category: "nope", message: "" }],
    requiredChanges: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("issues[0].category")));
  assert.ok(result.errors.some((e) => e.includes("issues[0].message")));
});

test("validateLynxReviewStructure rejects empty requiredChanges items", () => {
  const result = validateLynxReviewStructure({
    passed: false,
    summary: "Need changes",
    issues: [],
    requiredChanges: ["", "ok"],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("requiredChanges[0]")));
});

test("validateLynxReviewStructure rejects missing or empty summary", () => {
  const result = validateLynxReviewStructure({
    passed: true,
    summary: " ",
    issues: [],
    requiredChanges: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("summary")));
});
