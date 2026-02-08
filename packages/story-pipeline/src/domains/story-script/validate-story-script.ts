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
    if (!isNonEmptyString(input.input.sourceDir)) {
      errors.push("input.sourceDir is required");
    }
    if (!Number.isInteger(input.input.imageCount) || input.input.imageCount < 1) {
      errors.push("input.imageCount must be >= 1");
    }
    if (!Array.isArray(input.input.assets) || input.input.assets.length === 0) {
      errors.push("input.assets is required");
    } else {
      input.input.assets.forEach((asset, index) => {
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
    if (!Number.isInteger(input.video.width) || input.video.width <= 0) {
      errors.push("video.width must be > 0");
    }
    if (!Number.isInteger(input.video.height) || input.video.height <= 0) {
      errors.push("video.height must be > 0");
    }
    if (!Number.isInteger(input.video.fps) || input.video.fps <= 0) {
      errors.push("video.fps must be > 0");
    }
    if (!isFiniteNumber(input.video.durationSec) || input.video.durationSec <= 0) {
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
