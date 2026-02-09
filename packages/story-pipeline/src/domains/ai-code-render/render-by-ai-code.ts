import fs from "node:fs/promises";
import path from "node:path";

import type { StoryScript } from "../../contracts/story-script.types.ts";
import { stageRemotionAssets } from "../render-assets/stage-remotion-assets.ts";
import { locateBrowserExecutable } from "../template-render/browser-locator.ts";
import {
  bundleRemotionEntry,
  renderRemotionVideo,
  RemotionRenderError,
} from "../template-render/remotion-renderer.ts";
import { generateRemotionScene } from "./generate-remotion-scene.ts";

export type RenderByAiCodeInput = {
  storyScript: StoryScript;
  outputDir: string;
  browserExecutablePath?: string;
  compileAdapter?: (input: {
    generatedCodeDir: string;
    entryFilePath: string;
    compositionId: string;
    publicDir: string;
  }) => Promise<{ ok: true; serveUrl: string } | { ok: false; message: string; details?: string }>;
  renderAdapter?: (input: {
    generatedCodeDir: string;
    outputVideoPath: string;
    compositionId: string;
    serveUrl: string;
    browserExecutablePath?: string;
    inputProps?: Record<string, unknown>;
  }) => Promise<{ ok: true } | { ok: false; message: string; details?: string }>;
};

export type RenderByAiCodeFailure = {
  ok: false;
  generatedCodeDir: string;
  error: {
    stage: "compile" | "render";
    message: string;
    details?: string;
  };
};

export type RenderByAiCodeSuccess = {
  ok: true;
  mode: "ai_code";
  generatedCodeDir: string;
  videoPath: string;
};

export type RenderByAiCodeResult = RenderByAiCodeSuccess | RenderByAiCodeFailure;

export const renderByAiCode = async ({
  storyScript,
  outputDir,
  browserExecutablePath,
  compileAdapter = defaultCompileAdapter,
  renderAdapter = defaultRenderAdapter,
}: RenderByAiCodeInput): Promise<RenderByAiCodeResult> => {
  const generatedCodeDir = path.join(outputDir, "generated-remotion");
  await fs.mkdir(generatedCodeDir, { recursive: true });
  const compositionId = "LihuaCatGeneratedScene";

  const stagedAssets = await stageRemotionAssets({
    assets: storyScript.input.assets,
    outputDir,
  });
  const renderStoryScript: StoryScript = {
    ...storyScript,
    input: {
      ...storyScript.input,
      assets: stagedAssets.assets,
    },
  };

  const sceneCode = generateRemotionScene({ storyScript: renderStoryScript });
  const sceneFilePath = path.join(generatedCodeDir, "Scene.tsx");
  const entryFilePath = path.join(generatedCodeDir, "remotion.entry.tsx");
  await fs.writeFile(sceneFilePath, sceneCode, "utf8");
  await fs.writeFile(
    entryFilePath,
    buildGeneratedEntryCode({ storyScript: renderStoryScript, compositionId }),
    "utf8",
  );

  const compile = await compileAdapter({
    generatedCodeDir,
    entryFilePath,
    compositionId,
    publicDir: stagedAssets.publicDir,
  });
  if (!compile.ok) {
    return {
      ok: false,
      generatedCodeDir,
      error: {
        stage: "compile",
        message: compile.message,
        details: compile.details,
      },
    };
  }

  const outputVideoPath = path.join(outputDir, "video.mp4");
  const render = await renderAdapter({
    generatedCodeDir,
    outputVideoPath,
    compositionId,
    serveUrl: compile.serveUrl,
    browserExecutablePath,
    inputProps: {},
  });
  if (!render.ok) {
    return {
      ok: false,
      generatedCodeDir,
      error: {
        stage: "render",
        message: render.message,
        details: render.details,
      },
    };
  }

  return {
    ok: true,
    mode: "ai_code",
    generatedCodeDir,
    videoPath: outputVideoPath,
  };
};

const defaultCompileAdapter = async ({
  entryFilePath,
  publicDir,
}: {
  generatedCodeDir: string;
  entryFilePath: string;
  compositionId: string;
  publicDir: string;
}): Promise<{ ok: true; serveUrl: string } | { ok: false; message: string; details?: string }> => {
  try {
    const serveUrl = await bundleRemotionEntry({
      entryPoint: entryFilePath,
      publicDir,
    });
    return { ok: true, serveUrl };
  } catch (error) {
    if (error instanceof RemotionRenderError) {
      return {
        ok: false,
        message: error.message,
        details: error.details,
      };
    }
    return {
      ok: false,
      message: "Generated code bundle failed",
      details: error instanceof Error ? error.stack : String(error),
    };
  }
};

const defaultRenderAdapter = async ({
  outputVideoPath,
  compositionId,
  serveUrl,
  browserExecutablePath,
  inputProps = {},
}: {
  generatedCodeDir: string;
  outputVideoPath: string;
  compositionId: string;
  serveUrl: string;
  browserExecutablePath?: string;
  inputProps?: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; message: string; details?: string }> => {
  try {
    const browser = await locateBrowserExecutable({
      preferredPath: browserExecutablePath,
    });
    await renderRemotionVideo({
      serveUrl,
      compositionId,
      inputProps,
      outputFilePath: outputVideoPath,
      browserExecutablePath: browser.executablePath,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof RemotionRenderError) {
      return {
        ok: false,
        message: error.message,
        details: error.details,
      };
    }
    return {
      ok: false,
      message: "AI code render failed",
      details: error instanceof Error ? error.stack : String(error),
    };
  }
};

const buildGeneratedEntryCode = ({
  storyScript,
  compositionId,
}: {
  storyScript: StoryScript;
  compositionId: string;
}): string => {
  const durationInFrames = Math.max(
    1,
    Math.round(storyScript.video.durationSec * storyScript.video.fps),
  );

  return `import React from "react";
import { Composition, registerRoot } from "remotion";
import { GeneratedScene } from "./Scene";

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${compositionId}"
      component={GeneratedScene}
      width={${storyScript.video.width}}
      height={${storyScript.video.height}}
      fps={${storyScript.video.fps}}
      durationInFrames={${durationInFrames}}
      defaultProps={{}}
    />
  );
};

registerRoot(RemotionRoot);
`;
};
