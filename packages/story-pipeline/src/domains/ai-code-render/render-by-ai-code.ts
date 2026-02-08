import fs from "node:fs/promises";
import path from "node:path";

import type { StoryScript } from "../../contracts/story-script.types.ts";
import { generateRemotionScene } from "./generate-remotion-scene.ts";

export type RenderByAiCodeInput = {
  storyScript: StoryScript;
  outputDir: string;
  compileAdapter?: (input: {
    generatedCodeDir: string;
    entryFilePath: string;
  }) => Promise<{ ok: true } | { ok: false; message: string; details?: string }>;
  renderAdapter?: (input: {
    generatedCodeDir: string;
    outputVideoPath: string;
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
  compileAdapter = defaultCompileAdapter,
  renderAdapter = defaultRenderAdapter,
}: RenderByAiCodeInput): Promise<RenderByAiCodeResult> => {
  const generatedCodeDir = path.join(outputDir, "generated-remotion");
  await fs.mkdir(generatedCodeDir, { recursive: true });

  const sceneCode = generateRemotionScene({ storyScript });
  const entryFilePath = path.join(generatedCodeDir, "scene.generated.mjs");
  await fs.writeFile(entryFilePath, sceneCode, "utf8");

  const compile = await compileAdapter({
    generatedCodeDir,
    entryFilePath,
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
}: {
  generatedCodeDir: string;
  entryFilePath: string;
}): Promise<{ ok: true } | { ok: false; message: string; details?: string }> => {
  const code = await fs.readFile(entryFilePath, "utf8");
  if (code.includes("__FORCE_COMPILE_ERROR__")) {
    return {
      ok: false,
      message: "Generated code failed compile check",
      details: "Marker __FORCE_COMPILE_ERROR__ found in generated code.",
    };
  }
  return { ok: true };
};

const defaultRenderAdapter = async ({
  generatedCodeDir,
  outputVideoPath,
}: {
  generatedCodeDir: string;
  outputVideoPath: string;
}): Promise<{ ok: true } | { ok: false; message: string; details?: string }> => {
  const marker = path.join(generatedCodeDir, "force-render-error");
  try {
    await fs.access(marker);
    return {
      ok: false,
      message: "AI code render failed",
      details: "force-render-error marker exists",
    };
  } catch {
    await fs.writeFile(
      outputVideoPath,
      JSON.stringify(
        {
          mode: "ai_code",
          generatedCodeDir,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    return { ok: true };
  }
};
