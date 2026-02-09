import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StoryScript } from "../../contracts/story-script.types.ts";
import { stageRemotionAssets } from "../render-assets/stage-remotion-assets.ts";
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
    outputDir: string;
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
    outputDir,
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
  outputDir,
  outputFilePath,
  browserExecutablePath,
}: {
  storyScript: StoryScript;
  outputDir: string;
  outputFilePath: string;
  browserExecutablePath?: string;
}): Promise<void> => {
  try {
    const browser = await locateBrowserExecutable({
      preferredPath: browserExecutablePath,
    });

    const stagedAssets = await stageRemotionAssets({
      assets: storyScript.input.assets,
      outputDir,
    });

    const serveUrl = await bundleRemotionEntry({
      entryPoint: templateEntryPointPath,
      publicDir: stagedAssets.publicDir,
    });

    await renderRemotionVideo({
      serveUrl,
      compositionId: "LihuaCatStoryTemplate",
      inputProps: {
        ...storyScript,
        input: {
          ...storyScript.input,
          assets: stagedAssets.assets,
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
    "../../story-template/remotion-template.entry.tsx",
    import.meta.url,
  ),
);
