import type { StoryScript, StoryScriptValidationResult } from "../../contracts/story-script.types.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const validateStoryScriptStructure = (
  input: unknown,
): StoryScriptValidationResult & { script?: StoryScript } => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      errors: ["story-script must be an object"],
    };
  }

  if (!isNonEmptyString(input.version)) {
    errors.push("version is required");
  }

  if (!isRecord(input.input)) {
    errors.push("input is required");
  } else {
    const inputNode = input.input;
    if (!isNonEmptyString(inputNode.sourceDir)) {
      errors.push("input.sourceDir is required");
    }
    const imageCount = inputNode.imageCount;
    if (typeof imageCount !== "number" || !Number.isInteger(imageCount) || imageCount < 1) {
      errors.push("input.imageCount must be >= 1");
    }
    if (!Array.isArray(inputNode.assets) || inputNode.assets.length === 0) {
      errors.push("input.assets is required");
    } else {
      inputNode.assets.forEach((asset, index) => {
        if (!isRecord(asset)) {
          errors.push(`input.assets[${index}] must be an object`);
          return;
        }
        if (!isNonEmptyString(asset.id)) {
          errors.push(`input.assets[${index}].id is required`);
        }
        if (!isNonEmptyString(asset.path)) {
          errors.push(`input.assets[${index}].path is required`);
        }
      });
    }
  }

  if (!isRecord(input.video)) {
    errors.push("video is required");
  } else {
    const videoNode = input.video;
    const width = videoNode.width;
    if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
      errors.push("video.width must be > 0");
    }
    const height = videoNode.height;
    if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
      errors.push("video.height must be > 0");
    }
    const fps = videoNode.fps;
    if (typeof fps !== "number" || !Number.isInteger(fps) || fps <= 0) {
      errors.push("video.fps must be > 0");
    }
    if (!isFiniteNumber(videoNode.durationSec) || videoNode.durationSec <= 0) {
      errors.push("video.durationSec must be > 0");
    }
  }

  if (!isRecord(input.style) || !isNonEmptyString(input.style.preset)) {
    errors.push("style.preset is required");
  }

  if (!Array.isArray(input.timeline) || input.timeline.length === 0) {
    errors.push("timeline is required");
  } else {
    input.timeline.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`timeline[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(item.assetId)) {
        errors.push(`timeline[${index}].assetId is required`);
      }
      if (!isFiniteNumber(item.startSec) || item.startSec < 0) {
        errors.push(`timeline[${index}].startSec must be >= 0`);
      }
      if (!isFiniteNumber(item.endSec) || item.endSec <= 0) {
        errors.push(`timeline[${index}].endSec must be > 0`);
      }
      if (!isNonEmptyString(item.subtitleId)) {
        errors.push(`timeline[${index}].subtitleId is required`);
      }
    });
  }

  if (!Array.isArray(input.subtitles) || input.subtitles.length === 0) {
    errors.push("subtitles is required");
  } else {
    input.subtitles.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`subtitles[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(item.id)) {
        errors.push(`subtitles[${index}].id is required`);
      }
      if (!isNonEmptyString(item.text)) {
        errors.push(`subtitles[${index}].text is required`);
      }
      if (!isFiniteNumber(item.startSec) || item.startSec < 0) {
        errors.push(`subtitles[${index}].startSec must be >= 0`);
      }
      if (!isFiniteNumber(item.endSec) || item.endSec <= 0) {
        errors.push(`subtitles[${index}].endSec must be > 0`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    script: input as StoryScript,
  };
};
