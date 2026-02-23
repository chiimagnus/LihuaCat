import test from "node:test";
import assert from "node:assert/strict";

import { validateReviewLog, type ReviewLog } from "../src/contracts/review-log.types.ts";

test("validateReviewLog accepts a valid ocelot review log", () => {
  const reviewLog: ReviewLog = {
    reviewer: "ocelot",
    maxRounds: 3,
    finalPassed: true,
    rounds: [
      {
        round: 1,
        passed: false,
        summary: "视觉节奏与音乐情绪存在偏差",
        issues: [{ target: "cub", message: "高潮前鼓点过强" }],
        requiredChanges: [
          {
            target: "cub",
            instructions: ["弱化前半段鼓点", "保持高潮后再加速"],
          },
        ],
      },
      {
        round: 2,
        passed: true,
        summary: "视觉与音乐已对齐",
        issues: [],
        requiredChanges: [],
      },
    ],
  };

  const result = validateReviewLog(reviewLog);
  assert.equal(result.valid, true);
  assert.ok(result.reviewLog);
});

test("validateReviewLog rejects inconsistent rounds/maxRounds", () => {
  const result = validateReviewLog({
    reviewer: "ocelot",
    maxRounds: 1,
    finalPassed: false,
    rounds: [
      { round: 1, passed: false, summary: "r1", issues: [], requiredChanges: [] },
      { round: 2, passed: false, summary: "r2", issues: [], requiredChanges: [] },
    ],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must not exceed maxRounds")));
});

test("validateReviewLog rejects empty required change instructions", () => {
  const result = validateReviewLog({
    reviewer: "ocelot",
    maxRounds: 3,
    finalPassed: false,
    rounds: [
      {
        round: 1,
        passed: false,
        summary: "needs changes",
        issues: [{ target: "kitten", message: "字幕过长" }],
        requiredChanges: [
          {
            target: "kitten",
            instructions: [""],
          },
        ],
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("instructions[0]")));
});

