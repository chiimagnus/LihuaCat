import type { collectImages } from "../../domains/material-intake/collect-images.ts";
import type { TabbyAgentClient } from "../../domains/tabby/tabby-agent.client.ts";
import type { TabbySessionTui } from "../../domains/tabby/tabby-session.ts";
import type { runTabbySession } from "../../domains/tabby/tabby-session.ts";
import type { StoryBriefAgentClient } from "../../subagents/story-brief/story-brief.client.ts";
import type { generateStoryBrief } from "../../subagents/story-brief/generate-story-brief.ts";
import type { StoryBrief } from "../../contracts/story-brief.types.ts";
import type { TabbyConversationEvent } from "../../contracts/tabby-conversation.types.ts";
import type { WorkflowProgressReporter } from "../workflow-events.ts";
import {
  emitProgressAndPersist,
  pushRunLog,
  writeStageArtifact,
  writeStoryBriefArtifact,
  type WorkflowRuntimeArtifacts,
} from "../workflow-runtime.ts";

export type TabbyStageResult = {
  conversation: TabbyConversationEvent[];
  confirmedSummary: string;
  storyBrief: StoryBrief;
  attempts: number;
};

export const runTabbyStage = async ({
  collected,
  runtime,
  tabbyAgentClient,
  tabbyTui,
  storyBriefAgentClient,
  onProgress,
  runTabbySessionImpl,
  generateStoryBriefImpl,
}: {
  collected: Awaited<ReturnType<typeof collectImages>>;
  runtime: WorkflowRuntimeArtifacts;
  tabbyAgentClient: TabbyAgentClient;
  tabbyTui: TabbySessionTui;
  storyBriefAgentClient: StoryBriefAgentClient;
  onProgress?: WorkflowProgressReporter;
  runTabbySessionImpl: typeof runTabbySession;
  generateStoryBriefImpl: typeof generateStoryBrief;
}): Promise<TabbyStageResult> => {
  await emitProgressAndPersist(runtime, onProgress, {
    stage: "tabby_start",
    message: "Tabby is watching photos and chatting...",
  });

  const photos = collected.images.map((image) => ({
    photoRef: image.fileName,
    path: image.absolutePath,
  }));

  const conversationLogPath = runtime.tabbyConversationPath;
  const session = await runTabbySessionImpl({
    photos,
    client: tabbyAgentClient,
    tui: tabbyTui,
    conversationLogPath,
    maxReviseRounds: 3,
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "tabby_progress",
    message: "已确认「就是这个感觉」，正在生成 StoryBrief...",
  });

  const briefResult = await generateStoryBriefImpl({
    photos,
    conversation: session.conversation,
    confirmedSummary: session.confirmedSummary,
    client: storyBriefAgentClient,
    maxRetries: 2,
  });

  await pushRunLog(runtime, `storyBriefGeneratedInAttempts=${briefResult.attempts}`);
  await writeStoryBriefArtifact(runtime, briefResult.brief);
  await writeStageArtifact(runtime, "tabby-stage.json", {
    attempts: briefResult.attempts,
    confirmedSummary: session.confirmedSummary,
    conversationLogPath,
    createdAt: new Date().toISOString(),
  });

  await emitProgressAndPersist(runtime, onProgress, {
    stage: "tabby_done",
    message: `StoryBrief ready (attempts=${briefResult.attempts}).`,
  });

  return {
    conversation: session.conversation,
    confirmedSummary: session.confirmedSummary,
    storyBrief: briefResult.brief,
    attempts: briefResult.attempts,
  };
};
