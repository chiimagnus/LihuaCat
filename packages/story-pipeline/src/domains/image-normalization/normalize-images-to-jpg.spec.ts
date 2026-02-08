import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { CollectedImage } from "../material-intake/collect-images.ts";
import { normalizeImagesToJpg } from "./normalize-images-to-jpg.ts";

test("normalizes images to jpg with stable naming and source mapping", async () => {
  await withTempDir(async (dir) => {
    const sourceDir = path.join(dir, "source");
    const outputDir = path.join(dir, "output");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const pngPath = path.join(sourceDir, "2.png");
    const jpegPath = path.join(sourceDir, "1.jpeg");
    await fs.writeFile(pngPath, tinyPngBuffer());
    await convertToJpeg(pngPath, jpegPath);

    const inputImages: CollectedImage[] = [
      {
        index: 1,
        fileName: "1.jpeg",
        absolutePath: jpegPath,
        extension: ".jpeg",
      },
      {
        index: 2,
        fileName: "2.png",
        absolutePath: pngPath,
        extension: ".png",
      },
    ];

    const result = await normalizeImagesToJpg({
      images: inputImages,
      outputDir,
    });

    assert.equal(result.images.length, 2);
    assert.deepEqual(
      result.images.map((image) => image.outputFileName),
      ["001.jpg", "002.jpg"],
    );
    assert.deepEqual(
      result.images.map((image) => image.assetId),
      ["img_001", "img_002"],
    );
    assert.deepEqual(
      result.images.map((image) => image.sourcePath),
      [jpegPath, pngPath],
    );

    for (const image of result.images) {
      await assert.doesNotReject(fs.access(image.normalizedPath));
      assert.equal(path.extname(image.normalizedPath).toLowerCase(), ".jpg");
    }
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-normalize-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const tinyPngBuffer = (): Buffer =>
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3m2WQAAAAASUVORK5CYII=",
    "base64",
  );

const convertToJpeg = async (
  sourcePath: string,
  targetPath: string,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("sips", ["-s", "format", "jpeg", sourcePath, "--out", targetPath], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`sips failed with ${code}: ${stderr}`));
    });
  });
};
