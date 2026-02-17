import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { RenderScript } from "../../contracts/render-script.types.ts";
import type { LynxReview } from "../../contracts/lynx-review.types.ts";
import type { OcelotAgentClient } from "./ocelot-agent.client.ts";
import type { LynxAgentClient } from "../lynx/lynx-agent.client.ts";

export type ReviseRenderScriptWithLynxInput = {
  storyBriefRef: string;
  storyBrief: StoryBrief;
  photos: Array<{ photoRef: string; path: string }>;
  video: { width: number; height: number; fps: number };
  ocelotClient: OcelotAgentClient;
  lynxClient: LynxAgentClient;
  maxRounds?: number;
};

export type RenderScriptRevisionRound = {
  round: number;
  renderScript: RenderScript;
  lynxReview: LynxReview;
};

export type ReviseRenderScriptWithLynxResult = {
  finalScript: RenderScript;
  finalPassed: boolean;
  rounds: RenderScriptRevisionRound[];
};

export const reviseRenderScriptWithLynx = async ({
  storyBriefRef,
  storyBrief,
  photos,
  video,
  ocelotClient,
  lynxClient,
  maxRounds = 3,
}: ReviseRenderScriptWithLynxInput): Promise<ReviseRenderScriptWithLynxResult> => {
  const rounds: RenderScriptRevisionRound[] = [];
  let revisionNotes: string[] | undefined = undefined;

  for (let round = 1; round <= maxRounds; round += 1) {
    const renderScript = await ocelotClient.generateRenderScript({
      storyBriefRef,
      storyBrief,
      photos,
      video,
      revisionNotes,
    });

    const lynxReview = await lynxClient.reviewRenderScript({
      storyBriefRef,
      storyBrief,
      renderScriptRef: undefined,
      renderScript,
      round,
      maxRounds,
    });

    rounds.push({ round, renderScript, lynxReview });

    if (lynxReview.passed) {
      return {
        finalScript: renderScript,
        finalPassed: true,
        rounds,
      };
    }

    revisionNotes = lynxReview.requiredChanges;
  }

  const last = rounds[rounds.length - 1];
  if (!last) {
    throw new Error("Unexpected: no revision rounds were executed");
  }

  return {
    finalScript: last.renderScript,
    finalPassed: false,
    rounds,
  };
};

