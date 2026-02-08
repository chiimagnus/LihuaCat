import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StoryAgentClient } from "../domains/story-script/story-agent.client.ts";
import { collectImages } from "../domains/material-intake/collect-images.ts";
import { generateStoryScript } from "../domains/story-script/generate-story-script.ts";
import { RenderChoiceMachine, type RenderMode } from "../domains/render-choice/render-choice-machine.ts";
import { renderByTemplate } from "../domains/template-render/render-by-template.ts";
import { renderByAiCode } from "../domains/ai-code-render/render-by-ai-code.ts";
import { publishArtifacts, type PublishArtifactsInput } from "../domains/artifact-publish/publish-artifacts.ts";
import type { RunSummary } from "../domains/artifact-publish/build-run-summary.ts";

export type StartStoryRunInput = {
  sourceDir: string;
  now?: Date;
};

export type StartStoryRunResult = {
  runId: string;
  outputDir: string;
};

export type RunStoryWorkflowInput = {
  sourceDir: string;
  storyAgentClient: StoryAgentClient;
  style: {
    preset: string;
    prompt?: string;
  };
  chooseRenderMode: (state: {
    lastFailure?: { mode: RenderMode; reason: string };
  }) => Promise<RenderMode | "exit">;
  onRenderFailure?: (input: { mode: RenderMode; reason: string }) => Promise<void> | void;
  now?: Date;
};

export type RunStoryWorkflowDependencies = {
  collectImagesImpl?: typeof collectImages;
  generateStoryScriptImpl?: typeof generateStoryScript;
  renderByTemplateImpl?: typeof renderByTemplate;
  renderByAiCodeImpl?: typeof renderByAiCode;
  publishArtifactsImpl?: (input: PublishArtifactsInput) => Promise<RunSummary>;
};

export const startStoryRun = ({
  sourceDir,
  now = new Date(),
}: StartStoryRunInput): StartStoryRunResult => {
  const timestamp = formatTimestamp(now);
  const runId = `${timestamp}-${randomUUID().slice(0, 8)}`;
  const outputDir = path.join(sourceDir, "lihuacat-output", runId);
  return {
    runId,
    outputDir,
  };
};

export const runStoryWorkflow = async (
  {
    sourceDir,
    storyAgentClient,
    style,
    chooseRenderMode,
    onRenderFailure,
    now,
  }: RunStoryWorkflowInput,
  dependencies: RunStoryWorkflowDependencies = {},
): Promise<RunSummary> => {
  const collectImagesImpl = dependencies.collectImagesImpl ?? collectImages;
  const generateStoryScriptImpl = dependencies.generateStoryScriptImpl ?? generateStoryScript;
  const renderByTemplateImpl = dependencies.renderByTemplateImpl ?? renderByTemplate;
  const renderByAiCodeImpl = dependencies.renderByAiCodeImpl ?? renderByAiCode;
  const publishArtifactsImpl = dependencies.publishArtifactsImpl ?? publishArtifacts;

  const { runId, outputDir } = startStoryRun({ sourceDir, now });
  const runLogs: string[] = [`runId=${runId}`, `sourceDir=${sourceDir}`];
  const errorLogs: string[] = [];

  const collected = await collectImagesImpl({ sourceDir, maxImages: 20 });
  runLogs.push(`collectedImages=${collected.images.length}`);

  const scriptResult = await generateStoryScriptImpl({
    sourceDir,
    style,
    client: storyAgentClient,
    assets: collected.images.map((image, index) => ({
      id: `img_${String(index + 1).padStart(3, "0")}`,
      path: image.absolutePath,
    })),
    maxRetries: 2,
    constraints: {
      durationSec: 30,
      minDurationPerAssetSec: 1,
      requireAllAssetsUsed: true,
    },
  });

  runLogs.push(`storyScriptGeneratedInAttempts=${scriptResult.attempts}`);
  const machine = new RenderChoiceMachine();
  let generatedCodePath: string | undefined;

  while (machine.getState().phase !== "completed") {
    const state = machine.getState();
    const mode = await chooseRenderMode({
      lastFailure:
        state.phase === "select_mode"
          ? state.lastFailure
          : undefined,
    });

    if (mode === "exit") {
      throw new Error("Run exited by user before successful rendering.");
    }

    machine.selectMode(mode);
    runLogs.push(`modeSelected=${mode}`);

    if (mode === "template") {
      try {
        const rendered = await renderByTemplateImpl({
          storyScript: scriptResult.script,
          outputDir,
        });
        machine.markSuccess(rendered.videoPath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        errorLogs.push(`[template] ${reason}`);
        machine.markFailure(reason);
        if (onRenderFailure) {
          await onRenderFailure({ mode, reason });
        }
      }
      continue;
    }

    const aiRendered = await renderByAiCodeImpl({
      storyScript: scriptResult.script,
      outputDir,
    });
    if (!aiRendered.ok) {
      const reason = `${aiRendered.error.stage}: ${aiRendered.error.message}${
        aiRendered.error.details ? ` | ${aiRendered.error.details}` : ""
      }`;
      generatedCodePath = aiRendered.generatedCodeDir;
      errorLogs.push(`[ai_code] ${reason}`);
      machine.markFailure(reason);
      if (onRenderFailure) {
        await onRenderFailure({ mode, reason });
      }
      continue;
    }

    generatedCodePath = aiRendered.generatedCodeDir;
    machine.markSuccess(aiRendered.videoPath);
  }

  const finalState = machine.getState();
  if (finalState.phase !== "completed") {
    throw new Error("Internal workflow error: run finished without completion");
  }

  return publishArtifactsImpl({
    runId,
    outputDir,
    mode: finalState.mode,
    videoPath: finalState.videoPath,
    storyScript: scriptResult.script,
    runLogs,
    errorLogs,
    generatedCodePath,
  });
};

const formatTimestamp = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
};
