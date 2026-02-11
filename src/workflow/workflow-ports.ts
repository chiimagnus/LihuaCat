import { collectImages } from "../domains/material-intake/collect-images.ts";
import { renderByTemplate } from "../domains/template-render/render-by-template.ts";
import { publishArtifacts } from "../domains/artifact-publish/publish-artifacts.ts";
import { runTabbySession } from "../domains/tabby/tabby-session.ts";
import { generateStoryBrief } from "../domains/story-brief/generate-story-brief.ts";

export type WorkflowPorts = {
  collectImagesImpl: typeof collectImages;
  runTabbySessionImpl: typeof runTabbySession;
  generateStoryBriefImpl: typeof generateStoryBrief;
  renderByTemplateImpl: typeof renderByTemplate;
  publishArtifactsImpl: typeof publishArtifacts;
};

export const resolveWorkflowPorts = (
  overrides: Partial<WorkflowPorts> = {},
): WorkflowPorts => {
  return {
    collectImagesImpl: overrides.collectImagesImpl ?? collectImages,
    runTabbySessionImpl: overrides.runTabbySessionImpl ?? runTabbySession,
    generateStoryBriefImpl: overrides.generateStoryBriefImpl ?? generateStoryBrief,
    renderByTemplateImpl: overrides.renderByTemplateImpl ?? renderByTemplate,
    publishArtifactsImpl: overrides.publishArtifactsImpl ?? publishArtifacts,
  };
};
