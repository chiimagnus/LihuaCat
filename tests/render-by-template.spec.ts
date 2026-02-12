import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { renderByTemplateV2, TemplateRenderError } from "../src/domains/template-render/render-by-template.ts";
import type { RenderScript } from "../src/contracts/render-script.types.ts";

test("template render consumes render-script and produces video file", async () => {
  await withTempDir(async (outputDir) => {
    const assets = await writeTempAssets(outputDir);
    const result = await renderByTemplateV2({
      renderScript: buildValidRenderScript(),
      assets,
      outputDir,
      renderAdapter: async ({ outputFilePath }) => {
        await fs.writeFile(outputFilePath, "video");
      },
    });
    assert.equal(result.mode, "template");
    await assert.doesNotReject(fs.access(result.videoPath));
  });
});

test("template render rejects invalid semantic script", async () => {
  await withTempDir(async (outputDir) => {
    const assets = await writeTempAssets(outputDir);
    const invalid = buildValidRenderScript();
    invalid.scenes[0]!.durationSec = 1;
    await assert.rejects(
      renderByTemplateV2({
        renderScript: invalid,
        assets,
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

const writeTempAssets = async (
  outputDir: string,
): Promise<Array<{ photoRef: string; path: string }>> => {
  const asset1 = path.join(outputDir, "1.jpg");
  const asset2 = path.join(outputDir, "2.png");
  await fs.writeFile(asset1, "img-1");
  await fs.writeFile(asset2, "img-2");
  return [
    { photoRef: "1.jpg", path: asset1 },
    { photoRef: "2.png", path: asset2 },
  ];
};

const buildValidRenderScript = (): RenderScript => ({
  storyBriefRef: "/tmp/photos/lihuacat-output/run-1/story-brief.json",
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "first",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "cut", durationMs: 0, direction: "left" },
      kenBurns: { startScale: 1, endScale: 1.1, panDirection: "left" },
    },
    {
      sceneId: "scene_002",
      photoRef: "2.png",
      subtitle: "second",
      subtitlePosition: "bottom",
      durationSec: 15,
      transition: { type: "cut", durationMs: 0, direction: "left" },
      kenBurns: { startScale: 1, endScale: 1.1, panDirection: "right" },
    },
  ],
});
