import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { StoryScript } from "../../contracts/story-script.types.ts";
import { validateStoryScriptSemantics } from "../story-script/validate-story-script.semantics.ts";
import { locateBrowserExecutable } from "./browser-locator.ts";
import {
  bundleRemotionEntry,
  renderRemotionVideo,
  RemotionRenderError,
} from "./remotion-renderer.ts";

export type RenderByTemplateInput = {
  storyScript: StoryScript;
  outputDir: string;
  browserExecutablePath?: string;
  renderAdapter?: (input: {
    storyScript: StoryScript;
    outputFilePath: string;
    browserExecutablePath?: string;
  }) => Promise<void>;
};

export type RenderByTemplateResult = {
  mode: "template";
  videoPath: string;
};

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRenderError";
  }
}

export const renderByTemplate = async ({
  storyScript,
  outputDir,
  browserExecutablePath,
  renderAdapter = defaultTemplateRenderAdapter,
}: RenderByTemplateInput): Promise<RenderByTemplateResult> => {
  const semantic = validateStoryScriptSemantics(storyScript, {
    expectedDurationSec: 30,
    minDurationPerAssetSec: 1,
    requireAllAssetsUsed: true,
  });
  if (!semantic.valid) {
    throw new TemplateRenderError(`story-script semantics invalid: ${semantic.errors.join("; ")}`);
  }

  await fs.mkdir(outputDir, { recursive: true });
  const videoPath = path.join(outputDir, "video.mp4");
  await renderAdapter({
    storyScript,
    outputFilePath: videoPath,
    browserExecutablePath,
  });
  return {
    mode: "template",
    videoPath,
  };
};

const defaultTemplateRenderAdapter = async ({
  storyScript,
  outputFilePath,
  browserExecutablePath,
}: {
  storyScript: StoryScript;
  outputFilePath: string;
  browserExecutablePath?: string;
}): Promise<void> => {
  try {
    const browser = await locateBrowserExecutable({
      preferredPath: browserExecutablePath,
    });

    const serveUrl = await bundleRemotionEntry({
      entryPoint: templateEntryPointPath,
    });

    await renderRemotionVideo({
      serveUrl,
      compositionId: "LihuaCatStoryTemplate",
      inputProps: {
        ...storyScript,
        input: {
          ...storyScript.input,
          assets: storyScript.input.assets.map((asset) => ({
            ...asset,
            path: toRenderableAssetPath(asset.path),
          })),
        },
      },
      outputFilePath,
      browserExecutablePath: browser.executablePath,
    });
  } catch (error) {
    if (error instanceof RemotionRenderError) {
      throw new TemplateRenderError(
        `${error.stage}: ${error.message}${error.details ? ` | ${error.details}` : ""}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new TemplateRenderError(message);
  }
};

const templateEntryPointPath = fileURLToPath(
  new URL(
    "../../../../story-video/src/story-template/remotion-template.entry.tsx",
    import.meta.url,
  ),
);

const toRenderableAssetPath = (value: string): string => {
  if (/^https?:\/\//.test(value) || value.startsWith("file://")) {
    return value;
  }
  return pathToFileURL(path.resolve(value)).href;
};
