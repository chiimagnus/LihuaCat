import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StoryAsset } from "../../contracts/story-script.types.ts";

export type StageRemotionAssetsInput = {
  assets: StoryAsset[];
  outputDir: string;
};

export type StageRemotionAssetsResult = {
  publicDir: string;
  assets: StoryAsset[];
};

const stagedRootDirName = "lihuacat-assets";

export const stageRemotionAssets = async ({
  assets,
  outputDir,
}: StageRemotionAssetsInput): Promise<StageRemotionAssetsResult> => {
  const publicDir = path.join(outputDir, "remotion-public");
  const stagedRoot = path.join(publicDir, stagedRootDirName);
  await fs.mkdir(stagedRoot, { recursive: true });

  const stagedAssets: StoryAsset[] = [];
  for (const [index, asset] of assets.entries()) {
    if (/^https?:\/\//.test(asset.path)) {
      stagedAssets.push(asset);
      continue;
    }

    const localPath = toLocalFilePath(asset.path);
    const extension = path.extname(localPath) || ".jpg";
    const safeId = sanitizeForFileName(asset.id);
    const fileName = `${String(index + 1).padStart(3, "0")}-${safeId}${extension.toLowerCase()}`;
    const stagedAbsolutePath = path.join(stagedRoot, fileName);
    await fs.copyFile(localPath, stagedAbsolutePath);

    stagedAssets.push({
      ...asset,
      path: `/${stagedRootDirName}/${fileName}`,
    });
  }

  return {
    publicDir,
    assets: stagedAssets,
  };
};

const toLocalFilePath = (value: string): string => {
  if (value.startsWith("file://")) {
    return fileURLToPath(value);
  }
  return path.resolve(value);
};

const sanitizeForFileName = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "asset";
};
