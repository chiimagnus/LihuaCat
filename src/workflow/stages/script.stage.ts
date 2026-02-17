import fs from "node:fs/promises";

import type { collectImages } from "../../domains/material-intake/collect-images.ts";
import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { OcelotAgentClient } from "../../domains/render-script/ocelot-agent.client.ts";
import type { LynxAgentClient } from "../../domains/lynx/lynx-agent.client.ts";
import { reviseRenderScriptWithLynx } from "../../domains/render-script/revise-render-script-with-lynx.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeRenderScriptArtifact,
  writeStageArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export type ScriptStageResult = {
  renderScript: RenderScript;
  finalPassed: boolean;
  rounds: number;
};

export const runScriptStage = async ({
  collected,
  runtime,
  storyBriefRef,
  storyBrief,
  ocelotAgentClient,
  lynxAgentClient,
  onProgress,
  maxRounds = 3,
}: {
  collected: Awaited<ReturnType<typeof collectImages>>;
  runtime: WorkflowRuntimeArtifacts;
  storyBriefRef: string;
  storyBrief: StoryBrief;
  ocelotAgentClient: OcelotAgentClient;
  lynxAgentClient: LynxAgentClient;
  onProgress?: WorkflowProgressReporter;
  maxRounds?: number;
}): Promise<ScriptStageResult> => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "script_start",
    message: "Generating RenderScript with Lynx review loop...",
  });

  const photos = collected.images.map((image) => ({
    photoRef: image.fileName,
    path: image.absolutePath,
  }));

  const result = await reviseRenderScriptWithLynx({
    storyBriefRef,
    storyBrief,
    photos,
    video: { width: 1080, height: 1920, fps: 30 },
    ocelotClient: {
      async generateRenderScript(request) {
        return ocelotAgentClient.generateRenderScript({
          ...request,
          debug: {
            inputPath: runtime.ocelotInputPath,
            outputPath: runtime.ocelotOutputPath,
            promptLogPath: runtime.ocelotPromptLogPath,
          },
        });
      },
    },
    lynxClient: {
      async reviewRenderScript(request) {
        const promptLogPath = runtime.getLynxPromptLogPath(request.round);
        runtime.lynxPromptLogPaths.push(promptLogPath);
        return lynxAgentClient.reviewRenderScript({
          ...request,
          debug: { promptLogPath },
        });
      },
    },
    maxRounds,
  });

  for (const round of result.rounds) {
    const ocelotRevisionPath = runtime.getOcelotRevisionPath(round.round);
    runtime.ocelotRevisionPaths.push(ocelotRevisionPath);
    await fs.writeFile(
      ocelotRevisionPath,
      JSON.stringify(round.renderScript, null, 2),
      "utf8",
    );

    const lynxReviewPath = runtime.getLynxReviewPath(round.round);
    runtime.lynxReviewPaths.push(lynxReviewPath);
    await fs.writeFile(
      lynxReviewPath,
      JSON.stringify(round.lynxReview, null, 2),
      "utf8",
    );
  }

  await pushRunLog(runtime, `renderScriptGeneratedInAttempts=${result.rounds.length}`);
  await pushRunLog(runtime, `lynxReviewRounds=${result.rounds.length}`);
  await pushRunLog(runtime, `lynxFinalPassed=${result.finalPassed}`);

  await writeRenderScriptArtifact(runtime, result.finalScript);
  await writeStageArtifact(runtime, "render-script.json", result.finalScript);
  await writeStageArtifact(runtime, "script-stage.json", {
    rounds: result.rounds.length,
    finalPassed: result.finalPassed,
    createdAt: new Date().toISOString(),
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "script_done",
    message: `RenderScript ready (rounds=${result.rounds.length}, passed=${result.finalPassed}).`,
  });

  return {
    renderScript: result.finalScript,
    finalPassed: result.finalPassed,
    rounds: result.rounds.length,
  };
};

