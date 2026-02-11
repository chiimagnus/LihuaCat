import type {
  RenderScene,
  RenderScript,
  RenderScriptValidationResult,
  SlideDirection,
} from "../../contracts/render-script.types.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const SUBTITLE_POSITIONS = new Set(["bottom", "top", "center"]);
const TRANSITION_TYPES = new Set(["cut", "fade", "dissolve", "slide"]);
const PAN_DIRECTIONS = new Set(["left", "right", "up", "down", "center"]);
const SLIDE_DIRECTIONS = new Set(["left", "right", "up", "down"]);

export type RenderScriptSemanticRules = {
  fixedVideo?: { width: number; height: number; fps: number };
  expectedTotalDurationSec?: number;
  durationToleranceSec?: number;
  expectedPhotoRefs?: string[];
  requireAllPhotosUsed?: boolean;
  allowedSlideDirections?: SlideDirection[];
};

export const validateRenderScriptStructure = (
  input: unknown,
): RenderScriptValidationResult & { script?: RenderScript } => {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["render-script must be an object"] };
  }

  if (!isNonEmptyString(input.storyBriefRef)) {
    errors.push("storyBriefRef is required");
  }

  if (!isRecord(input.video)) {
    errors.push("video is required");
  } else {
    const video = input.video;
    if (!isPositiveInteger(video.width)) errors.push("video.width must be a positive integer");
    if (!isPositiveInteger(video.height)) errors.push("video.height must be a positive integer");
    if (!isPositiveInteger(video.fps)) errors.push("video.fps must be a positive integer");
  }

  if (!Array.isArray(input.scenes) || input.scenes.length === 0) {
    errors.push("scenes is required");
  } else {
    input.scenes.forEach((scene, index) => {
      if (!isRecord(scene)) {
        errors.push(`scenes[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(scene.sceneId)) errors.push(`scenes[${index}].sceneId is required`);
      if (!isNonEmptyString(scene.photoRef)) errors.push(`scenes[${index}].photoRef is required`);
      if (!isNonEmptyString(scene.subtitle)) errors.push(`scenes[${index}].subtitle is required`);
      if (!isNonEmptyString(scene.subtitlePosition)) {
        errors.push(`scenes[${index}].subtitlePosition is required`);
      } else if (!SUBTITLE_POSITIONS.has(scene.subtitlePosition)) {
        errors.push(`scenes[${index}].subtitlePosition must be bottom|top|center`);
      }
      if (!isFiniteNumber(scene.durationSec) || scene.durationSec <= 0) {
        errors.push(`scenes[${index}].durationSec must be > 0`);
      }
      if (!isRecord(scene.transition) || !isNonEmptyString(scene.transition.type)) {
        errors.push(`scenes[${index}].transition is required`);
      } else {
        if (!TRANSITION_TYPES.has(scene.transition.type)) {
          errors.push(`scenes[${index}].transition.type must be cut|fade|dissolve|slide`);
        }
        if (!isFiniteNumber(scene.transition.durationMs) || scene.transition.durationMs < 0) {
          errors.push(`scenes[${index}].transition.durationMs must be >= 0`);
        }
        if (scene.transition.type === "slide") {
          if (!isNonEmptyString(scene.transition.direction)) {
            errors.push(`scenes[${index}].transition.direction is required for slide`);
          } else if (!SLIDE_DIRECTIONS.has(scene.transition.direction)) {
            errors.push(`scenes[${index}].transition.direction must be left|right|up|down`);
          }
        }
      }

      if (scene.kenBurns !== undefined) {
        if (!isRecord(scene.kenBurns)) {
          errors.push(`scenes[${index}].kenBurns must be an object`);
        } else {
          const kb = scene.kenBurns;
          if (!isFiniteNumber(kb.startScale) || kb.startScale <= 0) {
            errors.push(`scenes[${index}].kenBurns.startScale must be > 0`);
          }
          if (!isFiniteNumber(kb.endScale) || kb.endScale <= 0) {
            errors.push(`scenes[${index}].kenBurns.endScale must be > 0`);
          }
          if (!isNonEmptyString(kb.panDirection)) {
            errors.push(`scenes[${index}].kenBurns.panDirection is required`);
          } else if (!PAN_DIRECTIONS.has(kb.panDirection)) {
            errors.push(`scenes[${index}].kenBurns.panDirection must be left|right|up|down|center`);
          }
        }
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], script: input as RenderScript };
};

export const validateRenderScriptSemantics = (
  script: RenderScript,
  rules: RenderScriptSemanticRules = {},
): RenderScriptValidationResult => {
  const errors: string[] = [];

  if (rules.expectedTotalDurationSec !== undefined) {
    const total = script.scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
    const tolerance = rules.durationToleranceSec ?? 1e-6;
    if (Math.abs(total - rules.expectedTotalDurationSec) > tolerance) {
      errors.push(
        `scenes total duration must be ${rules.expectedTotalDurationSec}, got ${total}`,
      );
    }
  }

  if (rules.fixedVideo) {
    const { width, height, fps } = rules.fixedVideo;
    if (script.video.width !== width) errors.push(`video.width must be ${width}, got ${script.video.width}`);
    if (script.video.height !== height) errors.push(`video.height must be ${height}, got ${script.video.height}`);
    if (script.video.fps !== fps) errors.push(`video.fps must be ${fps}, got ${script.video.fps}`);
  }

  if (rules.fixedVideo && rules.expectedTotalDurationSec !== undefined) {
    const fps = rules.fixedVideo.fps;
    const expectedFrames = Math.round(rules.expectedTotalDurationSec * fps);
    const totalFrames = script.scenes.reduce(
      (sum, scene) => sum + Math.max(1, Math.round(scene.durationSec * fps)),
      0,
    );
    if (totalFrames !== expectedFrames) {
      errors.push(`scenes total frames must be ${expectedFrames}, got ${totalFrames}`);
    }
  }

  if (rules.requireAllPhotosUsed && rules.expectedPhotoRefs) {
    const expected = new Set(rules.expectedPhotoRefs);
    const used = new Set(script.scenes.map((scene) => scene.photoRef));
    for (const ref of expected) {
      if (!used.has(ref)) {
        errors.push(`photoRef ${ref} is not used in scenes`);
      }
    }
  }

  if (rules.allowedSlideDirections) {
    const allowed = new Set(rules.allowedSlideDirections);
    script.scenes.forEach((scene: RenderScene, index) => {
      if (scene.transition.type !== "slide") {
        return;
      }
      if (!allowed.has(scene.transition.direction)) {
        errors.push(
          `scenes[${index}].transition.direction must be one of ${[...allowed].join(", ")}`,
        );
      }
    });
  }

  return { valid: errors.length === 0, errors };
};
