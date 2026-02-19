import { collectImages } from "../../tools/material-intake/collect-images.ts";
import { compressImagesToRemotionPublicDir } from "../../tools/material-intake/compress-images.ts";
import { renderByTemplateV2 } from "../../tools/render/render-by-template.ts";
import { publishArtifacts } from "../../tools/artifacts/publish-artifacts.ts";
import { runTabbySession } from "../../agents/tabby/tabby.session.ts";
import { generateStoryBrief } from "../../subagents/story-brief/generate-story-brief.ts";

export type WorkflowPorts = {
  collectImagesImpl: typeof collectImages;
  compressImagesImpl: typeof compressImagesToRemotionPublicDir;
  runTabbySessionImpl: typeof runTabbySession;
  generateStoryBriefImpl: typeof generateStoryBrief;
  renderByTemplateV2Impl: typeof renderByTemplateV2;
  publishArtifactsImpl: typeof publishArtifacts;
};

export const resolveWorkflowPorts = (
  overrides: Partial<WorkflowPorts> = {},
): WorkflowPorts => {
  return {
    collectImagesImpl: overrides.collectImagesImpl ?? collectImages,
    compressImagesImpl: overrides.compressImagesImpl ?? compressImagesToRemotionPublicDir,
    runTabbySessionImpl: overrides.runTabbySessionImpl ?? runTabbySession,
    generateStoryBriefImpl: overrides.generateStoryBriefImpl ?? generateStoryBrief,
    renderByTemplateV2Impl: overrides.renderByTemplateV2Impl ?? renderByTemplateV2,
    publishArtifactsImpl: overrides.publishArtifactsImpl ?? publishArtifacts,
  };
};

