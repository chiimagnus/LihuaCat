import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { publishArtifacts } from "./publish-artifacts.ts";
import type { StoryScript } from "../../contracts/story-script.types.ts";

test("publishes artifacts and returns summary with key paths", async () => {
  await withTempDir(async (outputDir) => {
    const videoPath = path.join(outputDir, "video.mp4");
    await fs.writeFile(videoPath, "video");

    const summary = await publishArtifacts({
      runId: "run-001",
      outputDir,
      mode: "template",
      videoPath,
      storyScript: buildStoryScript(),
      runLogs: ["run started", "run succeeded"],
    });

    assert.equal(summary.videoPath, videoPath);
    assert.ok(summary.storyScriptPath.endsWith("story-script.json"));
    assert.ok(summary.runLogPath.endsWith("run.log"));
    await assert.doesNotReject(fs.access(summary.storyScriptPath));
    await assert.doesNotReject(fs.access(summary.runLogPath));
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-artifacts-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const buildStoryScript = (): StoryScript => ({
  version: "1.0",
  input: {
    sourceDir: "/tmp/photos",
    imageCount: 1,
    assets: [{ id: "img_001", path: "1.jpg" }],
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
