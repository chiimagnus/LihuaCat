import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { renderByAiCode } from "./render-by-ai-code.ts";
import type { StoryScript } from "../../contracts/story-script.types.ts";

test("generates code into output directory and renders successfully", async () => {
  await withTempDir(async (outputDir) => {
    const sourceImagePath = path.join(outputDir, "1.jpg");
    await fs.writeFile(sourceImagePath, "img");

    const result = await renderByAiCode({
      storyScript: buildStoryScript(sourceImagePath),
      outputDir,
      compileAdapter: async () => ({
        ok: true,
        serveUrl: "file:///tmp/remotion-bundle/index.html",
      }),
      renderAdapter: async ({ outputVideoPath }) => {
        await fs.writeFile(outputVideoPath, "video");
        return { ok: true };
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      await assert.doesNotReject(fs.access(result.videoPath));
      const scenePath = path.join(result.generatedCodeDir, "Scene.tsx");
      await assert.doesNotReject(
        fs.access(scenePath),
      );
      const sceneCode = await fs.readFile(scenePath, "utf8");
      assert.match(sceneCode, /"\/lihuacat-assets\//);
      assert.doesNotMatch(sceneCode, /file:\/\//);
    }
  });
});

test("returns structured compile error when compile adapter fails", async () => {
  await withTempDir(async (outputDir) => {
    const sourceImagePath = path.join(outputDir, "1.jpg");
    await fs.writeFile(sourceImagePath, "img");

    const result = await renderByAiCode({
      storyScript: buildStoryScript(sourceImagePath),
      outputDir,
      compileAdapter: async () => ({
        ok: false,
        message: "typescript compile failed",
        details: "line 2: unexpected token",
      }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.stage, "compile");
      assert.equal(result.error.message, "typescript compile failed");
      assert.match(result.error.details ?? "", /unexpected token/);
    }
  });
});

test("returns structured render error when render adapter fails", async () => {
  await withTempDir(async (outputDir) => {
    const sourceImagePath = path.join(outputDir, "1.jpg");
    await fs.writeFile(sourceImagePath, "img");

    const result = await renderByAiCode({
      storyScript: buildStoryScript(sourceImagePath),
      outputDir,
      renderAdapter: async () => ({
        ok: false,
        message: "remotion render failed",
        details: "composition not found",
      }),
      compileAdapter: async () => ({
        ok: true,
        serveUrl: "file:///tmp/remotion-bundle/index.html",
      }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.stage, "render");
      assert.equal(result.error.message, "remotion render failed");
    }
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-ai-render-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const buildStoryScript = (sourceImagePath: string): StoryScript => ({
  version: "1.0",
  input: {
    sourceDir: "/tmp/photos",
    imageCount: 1,
    assets: [{ id: "img_001", path: sourceImagePath }],
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationSec: 30,
  },
  style: {
    preset: "healing",
  },
  timeline: [{ assetId: "img_001", startSec: 0, endSec: 30, subtitleId: "sub_1" }],
  subtitles: [{ id: "sub_1", text: "hello", startSec: 0, endSec: 30 }],
});
