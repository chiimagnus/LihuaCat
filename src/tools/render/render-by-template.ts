import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RenderScript } from "../../contracts/render-script.types.ts";
import { stageRemotionAssets } from "../../tools/render-assets/stage-remotion-assets.ts";
import {
  validateRenderScriptSemantics,
  validateRenderScriptStructure,
} from "../../agents/ocelot/ocelot.validate.ts";
import { locateBrowserExecutable } from "./browser-locator.ts";
import {
  bundleRemotionEntry,
  renderRemotionVideo,
  RemotionRenderError,
} from "./remotion-renderer.ts";

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

export type RenderByTemplateV2Input = {
  renderScript: RenderScript;
  assets: Array<{ photoRef: string; path: string }>;
  outputDir: string;
  browserExecutablePath?: string;
  renderAdapter?: (input: {
    inputProps: Record<string, unknown>;
    publicDir: string;
    outputDir: string;
    outputFilePath: string;
    browserExecutablePath?: string;
  }) => Promise<void>;
};

export const renderByTemplateV2 = async ({
  renderScript,
  assets,
  outputDir,
  browserExecutablePath,
  renderAdapter = defaultTemplateRenderAdapterV2,
}: RenderByTemplateV2Input): Promise<RenderByTemplateResult> => {
  const structure = validateRenderScriptStructure(renderScript);
  if (!structure.valid || !structure.script) {
    throw new TemplateRenderError(`render-script structure invalid: ${structure.errors.join("; ")}`);
  }
  const semantic = validateRenderScriptSemantics(structure.script, {
    fixedVideo: { width: 1080, height: 1920, fps: 30 },
    expectedTotalDurationSec: 30,
    expectedPhotoRefs: assets.map((asset) => asset.photoRef),
    requireAllPhotosUsed: true,
    allowedSlideDirections: ["left", "right"],
  });
  if (!semantic.valid) {
    throw new TemplateRenderError(`render-script semantics invalid: ${semantic.errors.join("; ")}`);
  }

  await fs.mkdir(outputDir, { recursive: true });
  const videoPath = path.join(outputDir, "video.mp4");
  const stagedAssets = await stageRemotionAssets({
    assets,
    outputDir,
  });
  await renderAdapter({
    inputProps: {
      ...structure.script,
      assets: stagedAssets.assets,
    } as Record<string, unknown>,
    publicDir: stagedAssets.publicDir,
    outputDir,
    outputFilePath: videoPath,
    browserExecutablePath,
  });

  return {
    mode: "template",
    videoPath,
  };
};

const defaultTemplateRenderAdapterV2 = async ({
  inputProps,
  publicDir,
  outputDir,
  outputFilePath,
  browserExecutablePath,
}: {
  inputProps: Record<string, unknown>;
  publicDir: string;
  outputDir: string;
  outputFilePath: string;
  browserExecutablePath?: string;
}): Promise<void> => {
  try {
    const browser = await locateBrowserExecutable({
      preferredPath: browserExecutablePath,
    });

    const serveUrl = await bundleRemotionEntry({
      entryPoint: templateEntryPointPath,
      publicDir,
    });

    await renderRemotionVideo({
      serveUrl,
      compositionId: "LihuaCatStoryTemplate",
      inputProps,
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
    "../../templates/remotion/remotion-template.entry.tsx",
    import.meta.url,
  ),
);
