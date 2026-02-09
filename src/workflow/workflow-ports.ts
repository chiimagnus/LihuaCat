import { collectImages } from "../domains/material-intake/collect-images.ts";
import { generateStoryScript } from "../domains/story-script/generate-story-script.ts";
import { renderByTemplate } from "../domains/template-render/render-by-template.ts";
import { renderByAiCode } from "../domains/ai-code-render/render-by-ai-code.ts";
import { publishArtifacts } from "../domains/artifact-publish/publish-artifacts.ts";

export type WorkflowPorts = {
  collectImagesImpl: typeof collectImages;
  generateStoryScriptImpl: typeof generateStoryScript;
  renderByTemplateImpl: typeof renderByTemplate;
  renderByAiCodeImpl: typeof renderByAiCode;
  publishArtifactsImpl: typeof publishArtifacts;
};

export const resolveWorkflowPorts = (
  overrides: Partial<WorkflowPorts> = {},
): WorkflowPorts => {
  return {
    collectImagesImpl: overrides.collectImagesImpl ?? collectImages,
    generateStoryScriptImpl:
      overrides.generateStoryScriptImpl ?? generateStoryScript,
    renderByTemplateImpl: overrides.renderByTemplateImpl ?? renderByTemplate,
    renderByAiCodeImpl: overrides.renderByAiCodeImpl ?? renderByAiCode,
    publishArtifactsImpl: overrides.publishArtifactsImpl ?? publishArtifacts,
  };
};
