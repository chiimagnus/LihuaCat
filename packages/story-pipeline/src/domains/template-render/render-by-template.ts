import fs from "node:fs/promises";
import path from "node:path";

import type { StoryScript } from "../../contracts/story-script.types.ts";
import { validateStoryScriptSemantics } from "../story-script/validate-story-script.semantics.ts";

export type RenderByTemplateInput = {
  storyScript: StoryScript;
  outputDir: string;
  renderAdapter?: (input: {
    storyScript: StoryScript;
    outputFilePath: string;
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
  });
  return {
    mode: "template",
    videoPath,
  };
};

const defaultTemplateRenderAdapter = async ({
  storyScript,
  outputFilePath,
}: {
  storyScript: StoryScript;
  outputFilePath: string;
}): Promise<void> => {
  const payload = {
    mode: "template",
    video: storyScript.video,
    timelineCount: storyScript.timeline.length,
    subtitleCount: storyScript.subtitles.length,
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(outputFilePath, JSON.stringify(payload, null, 2), "utf8");
};
