import { collectImages } from "../domains/material-intake/collect-images.ts";
import { compressImagesToRemotionPublicDir } from "../domains/material-intake/compress-images.ts";
import { renderByTemplateV2 } from "../domains/template-render/render-by-template.ts";
import { publishArtifacts } from "../domains/artifact-publish/publish-artifacts.ts";
import { runTabbySession } from "../domains/tabby/tabby-session.ts";
import { generateStoryBrief } from "../domains/story-brief/generate-story-brief.ts";

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
