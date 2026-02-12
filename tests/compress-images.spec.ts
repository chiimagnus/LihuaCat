import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { compressImagesToRemotionPublicDir } from "../src/domains/material-intake/compress-images.ts";

test("compresses images into remotion public directory (jpeg) and returns staged absolute paths", async () => {
  await withTempDir(async (dir) => {
    const sourceFile = path.join(dir, "1.jpeg");
    await fs.copyFile(path.join(process.cwd(), "tests", "fixture-photo-1.jpeg"), sourceFile);

    const result = await compressImagesToRemotionPublicDir({
      outputDir: dir,
      targetBytes: 300 * 1024,
      images: [{ index: 1, fileName: "1.jpeg", absolutePath: sourceFile }],
    });

    assert.equal(result.publicDir, path.join(dir, "remotion-public"));
    assert.equal(result.stagedDir, path.join(dir, "remotion-public", "lihuacat-assets"));
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0]?.extension, ".jpg");
    assert.equal(
      result.images[0]?.absolutePath,
      path.join(dir, "remotion-public", "lihuacat-assets", "001-1_jpeg.jpg"),
    );

    const staged = await fs.readFile(result.images[0]!.absolutePath);
    assert.equal(staged[0], 0xff);
    assert.equal(staged[1], 0xd8);

    assert.equal(result.report.length, 1);
    assert.equal(result.report[0]?.fileName, "1.jpeg");
    assert.equal(result.report[0]?.targetBytes, 300 * 1024);
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-compress-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

