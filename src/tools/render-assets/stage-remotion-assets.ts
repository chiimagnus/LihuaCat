import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type StageRemotionAsset = { path: string } & ({ id: string } | { photoRef: string });

export type StageRemotionAssetsInput<TAsset extends StageRemotionAsset = StageRemotionAsset> = {
  assets: TAsset[];
  outputDir: string;
};

export type StageRemotionAssetsResult<TAsset extends StageRemotionAsset = StageRemotionAsset> = {
  publicDir: string;
  assets: TAsset[];
};

const stagedRootDirName = "lihuacat-assets";

export const stageRemotionAssets = async <TAsset extends StageRemotionAsset>({
  assets,
  outputDir,
}: StageRemotionAssetsInput<TAsset>): Promise<StageRemotionAssetsResult<TAsset>> => {
  const publicDir = path.join(outputDir, "remotion-public");
  const stagedRoot = path.join(publicDir, stagedRootDirName);
  await fs.mkdir(stagedRoot, { recursive: true });

  const stagedAssets: TAsset[] = [];
  for (const [index, asset] of assets.entries()) {
    if (/^https?:\/\//.test(asset.path)) {
      stagedAssets.push(asset);
      continue;
    }

    const alreadyStagedRelative = normalizeAlreadyStagedRelativePath(asset.path);
    if (alreadyStagedRelative) {
      stagedAssets.push({
        ...asset,
        path: alreadyStagedRelative,
      } as TAsset);
      continue;
    }

    const localPath = toLocalFilePath(asset.path);
    if (isInsideDir(localPath, stagedRoot)) {
      const fileName = path.basename(localPath);
      stagedAssets.push({
        ...asset,
        path: `${stagedRootDirName}/${fileName}`,
      } as TAsset);
      continue;
    }

    const extension = path.extname(localPath) || ".jpg";
    const ref = "photoRef" in asset ? asset.photoRef : asset.id;
    const safeRef = sanitizeForFileName(ref);
    const fileName = `${String(index + 1).padStart(3, "0")}-${safeRef}${extension.toLowerCase()}`;
    const stagedAbsolutePath = path.join(stagedRoot, fileName);
    await fs.copyFile(localPath, stagedAbsolutePath);

    stagedAssets.push({
      ...asset,
      path: `${stagedRootDirName}/${fileName}`,
    } as TAsset);
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

const normalizeAlreadyStagedRelativePath = (value: string): string | null => {
  const normalized = value.replace(/^\/+/, "");
  if (!normalized.startsWith(`${stagedRootDirName}/`)) return null;
  const rest = normalized.slice(`${stagedRootDirName}/`.length);
  if (!rest || rest.includes("..") || rest.includes("\\") || rest.includes(":")) return null;
  return normalized;
};

const isInsideDir = (filePath: string, dirPath: string): boolean => {
  const relative = path.relative(dirPath, filePath);
  if (!relative) return false;
  if (relative.startsWith("..")) return false;
  if (path.isAbsolute(relative)) return false;
  return true;
};

