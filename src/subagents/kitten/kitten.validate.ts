import type { CreativePlan } from "../../contracts/creative-plan.types.ts";
import {
  validateVisualScript,
  type VisualScript,
  type VisualScriptValidationResult,
} from "../../contracts/visual-script.types.ts";

export type KittenValidationResult = VisualScriptValidationResult & { script?: VisualScript };

export const validateKittenOutput = (
  input: unknown,
  context: {
    creativePlan?: CreativePlan;
    expectedPhotoRefs?: string[];
    expectedTotalDurationSec?: number;
    durationToleranceSec?: number;
    expectedVideo?: { width: number; height: number; fps: number };
  } = {},
): KittenValidationResult => {
  const structure = validateVisualScript(input);
  if (!structure.valid || !structure.script) {
    return structure;
  }

  const errors: string[] = [];

  if (context.creativePlan && structure.script.creativePlanRef.length === 0) {
    errors.push("creativePlanRef is required");
  }

  if (context.expectedPhotoRefs && context.expectedPhotoRefs.length > 0) {
    const used = new Set(structure.script.scenes.map((scene) => scene.photoRef));
    for (const photoRef of context.expectedPhotoRefs) {
      if (!used.has(photoRef)) {
        errors.push(`photoRef ${photoRef} is not used in scenes`);
      }
    }
  }

  structure.script.scenes.forEach((scene, index) => {
    if (SUBTITLE_TIMELINE_RE.test(scene.subtitle) || SUBTITLE_TECHNICAL_RE.test(scene.subtitle)) {
      errors.push(
        `scenes[${index}].subtitle must be audience-facing narration, without timeline/music production terms`,
      );
    }
  });

  if (context.expectedVideo) {
    const video = structure.script.video;
    if (video.width !== context.expectedVideo.width) {
      errors.push(`video.width must be ${context.expectedVideo.width}, got ${video.width}`);
    }
    if (video.height !== context.expectedVideo.height) {
      errors.push(`video.height must be ${context.expectedVideo.height}, got ${video.height}`);
    }
    if (video.fps !== context.expectedVideo.fps) {
      errors.push(`video.fps must be ${context.expectedVideo.fps}, got ${video.fps}`);
    }
  }

  if (typeof context.expectedTotalDurationSec === "number") {
    const totalDurationSec = structure.script.scenes.reduce(
      (sum, scene) => sum + scene.durationSec,
      0,
    );
    const tolerance = context.durationToleranceSec ?? 1e-6;
    if (Math.abs(totalDurationSec - context.expectedTotalDurationSec) > tolerance) {
      errors.push(
        `total visual duration must equal ${context.expectedTotalDurationSec}s`,
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], script: structure.script };
};

const SUBTITLE_TIMELINE_RE = /\d+\s*[-~到]\s*\d+\s*秒|\d+\s*秒后|\d+\s*ms\b/i;
const SUBTITLE_TECHNICAL_RE =
  /(midi|bpm|track|tracks|velocity|db\b|hz\b|acoustic guitar|piano|strings|bass|drums|音轨|手鼓|拍掌|木吉他|钢琴|弦乐|贝斯|鼓点|高频|低频)/i;
