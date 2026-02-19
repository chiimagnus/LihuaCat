import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { stageRemotionAssets } from "../src/tools/render-assets/stage-remotion-assets.ts";

test("stages local assets into remotion public directory", async () => {
  await withTempDir(async (dir) => {
    const sourceFile = path.join(dir, "source.jpg");
    await fs.writeFile(sourceFile, "img-data");

    const result = await stageRemotionAssets({
      outputDir: dir,
      assets: [{ id: "img_001", path: sourceFile }],
    });

    assert.equal(result.assets[0]?.path, "lihuacat-assets/001-img_001.jpg");
    const stagedFile = path.join(
      result.publicDir,
      "lihuacat-assets",
      "001-img_001.jpg",
    );
    await assert.doesNotReject(fs.access(stagedFile));
  });
});

test("stages file URL assets into remotion public directory", async () => {
  await withTempDir(async (dir) => {
    const sourceFile = path.join(dir, "source.png");
    await fs.writeFile(sourceFile, "png-data");

    const result = await stageRemotionAssets({
      outputDir: dir,
      assets: [{ id: "img_002", path: pathToFileURL(sourceFile).href }],
    });

    assert.equal(result.assets[0]?.path, "lihuacat-assets/001-img_002.png");
  });
});

test("stages photoRef assets into remotion public directory", async () => {
  await withTempDir(async (dir) => {
    const sourceFile = path.join(dir, "a.jpeg");
    await fs.writeFile(sourceFile, "img-data");

    const result = await stageRemotionAssets({
      outputDir: dir,
      assets: [{ photoRef: "1.jpeg", path: sourceFile }],
    });

    assert.equal(result.assets[0]?.path, "lihuacat-assets/001-1_jpeg.jpeg");
  });
});

test("keeps remote asset URL unchanged", async () => {
  await withTempDir(async (dir) => {
    const remoteUrl = "https://example.com/a.jpg";
    const result = await stageRemotionAssets({
      outputDir: dir,
      assets: [{ id: "img_003", path: remoteUrl }],
    });

    assert.equal(result.assets[0]?.path, remoteUrl);
  });
});

test("keeps already-staged relative assets unchanged", async () => {
  await withTempDir(async (dir) => {
    const stagedDir = path.join(dir, "remotion-public", "lihuacat-assets");
    await fs.mkdir(stagedDir, { recursive: true });
    await fs.writeFile(path.join(stagedDir, "001-x.jpg"), "img-data");

    const result = await stageRemotionAssets({
      outputDir: dir,
      assets: [{ id: "img_004", path: "lihuacat-assets/001-x.jpg" }],
    });

    assert.equal(result.assets[0]?.path, "lihuacat-assets/001-x.jpg");
  });
});

test("keeps assets already inside staged directory without copying", async () => {
  await withTempDir(async (dir) => {
    const stagedDir = path.join(dir, "remotion-public", "lihuacat-assets");
    await fs.mkdir(stagedDir, { recursive: true });
    const stagedFile = path.join(stagedDir, "001-y.jpg");
    await fs.writeFile(stagedFile, "img-data");

    const result = await stageRemotionAssets({
      outputDir: dir,
      assets: [{ id: "img_005", path: stagedFile }],
    });

    assert.equal(result.assets[0]?.path, "lihuacat-assets/001-y.jpg");
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-stage-assets-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
