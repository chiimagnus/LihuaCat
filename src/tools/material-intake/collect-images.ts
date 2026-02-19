import fs from "node:fs/promises";
import path from "node:path";

import {
  NoSupportedImagesError,
  SourceDirectoryNotFoundError,
  TooManyImagesError,
  UnsupportedImageFormatError,
} from "./material-intake.errors.ts";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const KNOWN_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".gif",
  ".bmp",
  ".tiff",
  ".tif",
  ".avif",
]);

export type CollectedImage = {
  index: number;
  fileName: string;
  absolutePath: string;
  extension: ".jpg" | ".jpeg" | ".png";
};

export type CollectImagesInput = {
  sourceDir: string;
  maxImages?: number;
};

export type CollectImagesResult = {
  sourceDir: string;
  images: CollectedImage[];
};

export const collectImages = async ({
  sourceDir,
  maxImages = 20,
}: CollectImagesInput): Promise<CollectImagesResult> => {
  const sourceStat = await safeStat(sourceDir);
  if (!sourceStat || !sourceStat.isDirectory()) {
    throw new SourceDirectoryNotFoundError(sourceDir);
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const unsupportedImages = fileNames.filter((name) => {
    const ext = path.extname(name).toLowerCase();
    return KNOWN_IMAGE_EXTENSIONS.has(ext) && !SUPPORTED_EXTENSIONS.has(ext);
  });
  if (unsupportedImages.length > 0) {
    throw new UnsupportedImageFormatError(unsupportedImages);
  }

  const images = fileNames
    .filter((name): name is string => {
      const ext = path.extname(name).toLowerCase();
      return SUPPORTED_EXTENSIONS.has(ext);
    })
    .map((fileName, index): CollectedImage => {
      const extension = path.extname(fileName).toLowerCase() as
        | ".jpg"
        | ".jpeg"
        | ".png";
      return {
        index: index + 1,
        fileName,
        absolutePath: path.join(sourceDir, fileName),
        extension,
      };
    });

  if (images.length === 0) {
    throw new NoSupportedImagesError(sourceDir);
  }

  if (images.length > maxImages) {
    throw new TooManyImagesError(maxImages, images.length);
  }

  return {
    sourceDir,
    images,
  };
};

const safeStat = async (filePath: string) => {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
};

