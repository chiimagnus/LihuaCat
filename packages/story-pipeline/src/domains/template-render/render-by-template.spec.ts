import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { renderByTemplate, TemplateRenderError } from "./render-by-template.ts";
import type { StoryScript } from "../../contracts/story-script.types.ts";

test("template render consumes story-script and produces video file", async () => {
  await withTempDir(async (outputDir) => {
    const result = await renderByTemplate({
      storyScript: buildValidStoryScript(),
      outputDir,
    });
    assert.equal(result.mode, "template");
    await assert.doesNotReject(fs.access(result.videoPath));
  });
});

test("template render rejects invalid semantic script", async () => {
  await withTempDir(async (outputDir) => {
    const invalid = buildValidStoryScript();
    invalid.timeline[0]!.endSec = 0.2;
    await assert.rejects(
      renderByTemplate({
        storyScript: invalid,
        outputDir,
      }),
      TemplateRenderError,
    );
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-template-render-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const buildValidStoryScript = (): StoryScript => ({
  version: "1.0",
  input: {
    sourceDir: "/tmp/photos",
    imageCount: 2,
    assets: [
      { id: "img_001", path: "1.jpg" },
      { id: "img_002", path: "2.png" },
    ],
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
  timeline: [
    { assetId: "img_001", startSec: 0, endSec: 10, subtitleId: "sub_1" },
    { assetId: "img_002", startSec: 10, endSec: 30, subtitleId: "sub_2" },
  ],
  subtitles: [
    { id: "sub_1", text: "first", startSec: 0, endSec: 10 },
    { id: "sub_2", text: "second", startSec: 10, endSec: 30 },
  ],
});
