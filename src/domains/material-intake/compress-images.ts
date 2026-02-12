import fs from "node:fs/promises";
import path from "node:path";

export type CompressImagesInput = {
  images: Array<{
    index: number;
    fileName: string;
    absolutePath: string;
  }>;
  outputDir: string;
  targetBytes?: number;
};

export type CompressedImage = {
  index: number;
  fileName: string;
  absolutePath: string;
  extension: ".jpg";
};

export type CompressImagesReportItem = {
  index: number;
  fileName: string;
  originalAbsolutePath: string;
  stagedAbsolutePath: string;
  originalBytes: number;
  stagedBytes: number;
  targetBytes: number;
  quality: number;
  scale: number;
  warning?: string;
};

export type CompressImagesResult = {
  publicDir: string;
  stagedDir: string;
  images: CompressedImage[];
  report: CompressImagesReportItem[];
};

const stagedRootDirName = "lihuacat-assets";
const DEFAULT_TARGET_BYTES = 300 * 1024;

export const compressImagesToRemotionPublicDir = async ({
  images,
  outputDir,
  targetBytes = DEFAULT_TARGET_BYTES,
}: CompressImagesInput): Promise<CompressImagesResult> => {
  const sharp = await loadSharp();
  const publicDir = path.join(outputDir, "remotion-public");
  const stagedDir = path.join(publicDir, stagedRootDirName);
  await fs.mkdir(stagedDir, { recursive: true });

  const compressedImages: CompressedImage[] = [];
  const report: CompressImagesReportItem[] = [];

  for (const image of images) {
    const originalAbsolutePath = image.absolutePath;
    const safeRef = sanitizeForFileName(image.fileName);
    const fileName = `${String(image.index).padStart(3, "0")}-${safeRef}.jpg`;
    const stagedAbsolutePath = path.join(stagedDir, fileName);

    const originalStat = await fs.stat(originalAbsolutePath);
    const originalBytes = originalStat.size;

    const base = sharp(originalAbsolutePath, { failOnError: false }).rotate();
    const metadata = await base.metadata();

    const scales = [1, 0.85, 0.7, 0.55];
    const qualities = [82, 74, 66, 58, 50, 42];

    let best:
      | { buffer: Buffer; bytes: number; quality: number; scale: number }
      | undefined;
    let firstUnderTarget:
      | { buffer: Buffer; bytes: number; quality: number; scale: number }
      | undefined;

    for (const scale of scales) {
      for (const quality of qualities) {
        let pipeline = base.clone();
        if (metadata.hasAlpha) {
          pipeline = pipeline.flatten({ background: "#ffffff" });
        }
        if (metadata.width && metadata.height && Number.isFinite(metadata.width) && Number.isFinite(metadata.height)) {
          const maxWidth = Math.max(1, Math.round(metadata.width * scale));
          const maxHeight = Math.max(1, Math.round(metadata.height * scale));
          pipeline = pipeline.resize({
            width: maxWidth,
            height: maxHeight,
            fit: "inside",
            withoutEnlargement: true,
          });
        }

        const buffer = await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();

        const bytes = buffer.byteLength;
        if (!best || bytes < best.bytes) {
          best = { buffer, bytes, quality, scale };
        }
        if (bytes <= targetBytes) {
          firstUnderTarget = { buffer, bytes, quality, scale };
          break;
        }
      }
      if (firstUnderTarget) break;
    }

    const chosen = firstUnderTarget ?? best;
    if (!chosen) {
      throw new Error(`compress failed: no candidate produced for ${originalAbsolutePath}`);
    }

    await fs.writeFile(stagedAbsolutePath, chosen.buffer);

    const warning =
      chosen.bytes > targetBytes
        ? `compressed image still exceeds targetBytes (stagedBytes=${chosen.bytes}, targetBytes=${targetBytes})`
        : undefined;

    compressedImages.push({
      index: image.index,
      fileName: image.fileName,
      absolutePath: stagedAbsolutePath,
      extension: ".jpg",
    });

    report.push({
      index: image.index,
      fileName: image.fileName,
      originalAbsolutePath,
      stagedAbsolutePath,
      originalBytes,
      stagedBytes: chosen.bytes,
      targetBytes,
      quality: chosen.quality,
      scale: chosen.scale,
      warning,
    });
  }

  return {
    publicDir,
    stagedDir,
    images: compressedImages,
    report,
  };
};

const sanitizeForFileName = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "asset";
};

const loadSharp = async () => {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "sharp is required for image compression but failed to load.",
        "If you use pnpm and see 'Ignored build scripts: sharp', run:",
        "- pnpm approve-builds",
        "- pnpm rebuild sharp",
        `Original error: ${message}`,
      ].join("\n"),
    );
  }
};
