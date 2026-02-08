import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import type { CollectedImage } from "../material-intake/collect-images.ts";
import { ImageConvertFailedError } from "./image-normalization.errors.ts";

export type NormalizeImagesToJpgInput = {
  images: CollectedImage[];
  outputDir: string;
};

export type NormalizedImage = {
  assetId: string;
  sourcePath: string;
  normalizedPath: string;
  outputFileName: string;
};

export type NormalizeImagesToJpgResult = {
  normalizedDir: string;
  images: NormalizedImage[];
};

export const normalizeImagesToJpg = async ({
  images,
  outputDir,
}: NormalizeImagesToJpgInput): Promise<NormalizeImagesToJpgResult> => {
  const normalizedDir = path.join(outputDir, "preprocessed");
  await fs.mkdir(normalizedDir, { recursive: true });

  const normalizedImages: NormalizedImage[] = [];

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i]!;
    const fileName = `${String(i + 1).padStart(3, "0")}.jpg`;
    const normalizedPath = path.join(normalizedDir, fileName);

    if (image.extension === ".jpg" || image.extension === ".jpeg") {
      await fs.copyFile(image.absolutePath, normalizedPath);
    } else {
      await convertToJpgUsingSips(image.absolutePath, normalizedPath);
    }

    normalizedImages.push({
      assetId: `img_${String(i + 1).padStart(3, "0")}`,
      sourcePath: image.absolutePath,
      normalizedPath,
      outputFileName: fileName,
    });
  }

  return {
    normalizedDir,
    images: normalizedImages,
  };
};

const convertToJpgUsingSips = async (
  sourcePath: string,
  outputPath: string,
): Promise<void> => {
  const args = ["-s", "format", "jpeg", sourcePath, "--out", outputPath];
  const { stderr, exitCode } = await runProcess("sips", args);
  if (exitCode !== 0) {
    throw new ImageConvertFailedError(sourcePath, outputPath, stderr);
  }
};

const runProcess = (
  command: string,
  args: string[],
): Promise<{ exitCode: number; stderr: string }> =>
  new Promise((resolve, reject) => {
    const processRef = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    processRef.on("error", reject);
    processRef.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr,
      });
    });
  });
