import test from "node:test";
import assert from "node:assert/strict";

import { runRenderStoryCommand } from "../src/commands/render-story.command.ts";
import { SourceDirectoryNotFoundError } from "../../story-pipeline/src/domains/material-intake/material-intake.errors.ts";
import { StoryScriptGenerationFailedError } from "../../story-pipeline/src/domains/story-script/generate-story-script.ts";

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

test("prints selected Codex model info when using real agent", async () => {
  const out = createBufferWriter();
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: [
      "--input",
      "/tmp/photos",
      "--model",
      "gpt-5.1-codex-mini",
      "--model-reasoning-effort",
      "medium",
    ],
    stdout: out,
    stderr: err,
    workflowImpl: async () => ({
      runId: "run-model-info",
      outputDir: "/tmp/photos/lihuacat-output/run-model-info",
      mode: "template",
      videoPath: "/tmp/photos/lihuacat-output/run-model-info/video.mp4",
      storyScriptPath: "/tmp/photos/lihuacat-output/run-model-info/story-script.json",
      runLogPath: "/tmp/photos/lihuacat-output/run-model-info/run.log",
    }),
  });

  assert.equal(exitCode, 0);
  assert.match(
    out.content(),
    /\[info\] Using Codex model: gpt-5\.1-codex-mini \(reasoning: medium\)/,
  );
  assert.equal(err.content(), "");
});

test("accepts xhigh reasoning effort and prints it in model info", async () => {
  const out = createBufferWriter();
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: [
      "--input",
      "/tmp/photos",
      "--model",
      "gpt-5.1-codex-mini",
      "--model-reasoning-effort",
      "xhigh",
    ],
    stdout: out,
    stderr: err,
    workflowImpl: async () => ({
      runId: "run-model-xhigh",
      outputDir: "/tmp/photos/lihuacat-output/run-model-xhigh",
      mode: "template",
      videoPath: "/tmp/photos/lihuacat-output/run-model-xhigh/video.mp4",
      storyScriptPath: "/tmp/photos/lihuacat-output/run-model-xhigh/story-script.json",
      runLogPath: "/tmp/photos/lihuacat-output/run-model-xhigh/run.log",
    }),
  });

  assert.equal(exitCode, 0);
  assert.match(
    out.content(),
    /\[info\] Using Codex model: gpt-5\.1-codex-mini \(reasoning: xhigh\)/,
  );
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

test("prints input tip when source directory path is invalid", async () => {
  const out = createBufferWriter();
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: ["--input", "/tmp/a.jpg /tmp/b.jpg", "--mock-agent"],
    stdout: out,
    stderr: err,
    workflowImpl: async () => {
      throw new SourceDirectoryNotFoundError("/tmp/a.jpg /tmp/b.jpg");
    },
  });

  assert.equal(exitCode, 1);
  assert.match(err.content(), /Expected one directory path/);
  assert.match(err.content(), /Input tip:/);
});

test("prints workflow progress events", async () => {
  const out = createBufferWriter();
  const err = createBufferWriter();

  const exitCode = await runRenderStoryCommand({
    argv: ["--input", "/tmp/photos", "--mock-agent"],
    stdout: out,
    stderr: err,
    workflowImpl: async ({ onProgress }) => {
      await onProgress?.({
        stage: "collect_images_start",
        message: "Collecting images from input directory...",
      });
      await onProgress?.({
        stage: "generate_script_start",
        message: "Generating story script with Codex...",
      });
      return {
        runId: "run-2",
        outputDir: "/tmp/photos/lihuacat-output/run-2",
        mode: "template",
        videoPath: "/tmp/photos/lihuacat-output/run-2/video.mp4",
        storyScriptPath: "/tmp/photos/lihuacat-output/run-2/story-script.json",
        runLogPath: "/tmp/photos/lihuacat-output/run-2/run.log",
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.match(out.content(), /\[progress\] Collecting images from input directory/);
  assert.match(out.content(), /\[progress\] Generating story script with Codex/);
  assert.equal(err.content(), "");
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
