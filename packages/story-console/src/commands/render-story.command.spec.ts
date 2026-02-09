import test from "node:test";
import assert from "node:assert/strict";

import { runRenderStoryCommand } from "./render-story.command.ts";
import { StoryScriptGenerationFailedError } from "../../../story-pipeline/src/domains/story-script/generate-story-script.ts";

test("prints key artifact paths on success", async () => {
  const out = createBufferWriter();
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: ["--input", "/tmp/photos", "--mock-agent"],
    stdout: out,
    stderr: err,
    workflowImpl: async () => ({
      runId: "run-1",
      outputDir: "/tmp/photos/lihuacat-output/run-1",
      mode: "template",
      videoPath: "/tmp/photos/lihuacat-output/run-1/video.mp4",
      storyScriptPath: "/tmp/photos/lihuacat-output/run-1/story-script.json",
      runLogPath: "/tmp/photos/lihuacat-output/run-1/run.log",
      generatedCodePath: "/tmp/photos/lihuacat-output/run-1/generated-remotion",
    }),
  });

  assert.equal(exitCode, 0);
  assert.match(out.content(), /videoPath:/);
  assert.match(out.content(), /storyScriptPath:/);
  assert.match(out.content(), /runLogPath:/);
  assert.equal(err.content(), "");
});

test("prints readable failure reason", async () => {
  const out = createBufferWriter();
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: ["--input", "/tmp/photos", "--mock-agent"],
    stdout: out,
    stderr: err,
    workflowImpl: async () => {
      throw new Error("template render failed: composition missing");
    },
  });

  assert.equal(exitCode, 1);
  assert.match(err.content(), /Render failed:/);
  assert.match(err.content(), /template render failed/);
});

test("prints generation failure details when story script retries are exhausted", async () => {
  const out = createBufferWriter();
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: ["--input", "/tmp/photos", "--mock-agent"],
    stdout: out,
    stderr: err,
    workflowImpl: async () => {
      throw new StoryScriptGenerationFailedError(3, [
        "attempt 1: missing codex auth",
        "attempt 2: model returned invalid JSON",
        "attempt 3: timeline duration mismatch",
      ]);
    },
  });

  assert.equal(exitCode, 1);
  assert.match(err.content(), /Story script generation failure details:/);
  assert.match(err.content(), /attempt 1: missing codex auth/);
  assert.match(err.content(), /attempt 3: timeline duration mismatch/);
});

const createBufferWriter = () => {
  const chunks: string[] = [];
  return {
    write(chunk: string) {
      chunks.push(chunk);
    },
    content() {
      return chunks.join("");
    },
  };
};
