import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { collectImages } from "./collect-images.ts";
import {
  NoSupportedImagesError,
  SourceDirectoryNotFoundError,
  TooManyImagesError,
  UnsupportedImageFormatError,
} from "./material-intake.errors.ts";

test("throws when source directory is missing", async () => {
  await assert.rejects(
    collectImages({ sourceDir: "/tmp/lihuacat-not-exists" }),
    SourceDirectoryNotFoundError,
  );
});

test("throws when no supported images exist", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "notes.txt"), "hello");
    await assert.rejects(
      collectImages({ sourceDir: dir }),
      NoSupportedImagesError,
    );
  });
});

test("throws when unsupported image format exists", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "photo.webp"), "fake");
    await assert.rejects(
      collectImages({ sourceDir: dir }),
      UnsupportedImageFormatError,
    );
  });
});

test("throws when image count is above max", async () => {
  await withTempDir(async (dir) => {
    for (let i = 1; i <= 3; i += 1) {
      await fs.writeFile(path.join(dir, `${i}.jpg`), "fake");
    }
    await assert.rejects(collectImages({ sourceDir: dir, maxImages: 2 }), {
      name: TooManyImagesError.name,
    });
  });
});

test("collects and sorts supported images", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "10.jpg"), "fake");
    await fs.writeFile(path.join(dir, "2.png"), "fake");
    await fs.writeFile(path.join(dir, "1.jpeg"), "fake");

    const result = await collectImages({ sourceDir: dir });
    assert.equal(result.images.length, 3);
    assert.deepEqual(
      result.images.map((image) => image.fileName),
      ["1.jpeg", "2.png", "10.jpg"],
    );
    assert.deepEqual(
      result.images.map((image) => image.index),
      [1, 2, 3],
    );
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-intake-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
