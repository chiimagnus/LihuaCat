import type {
  KenBurnsEffect,
  RenderTransition,
  SubtitlePosition,
  VideoSpec,
} from "./render-script.types.ts";

export type VisualScene = {
  sceneId: string;
  photoRef: string;
  subtitle: string;
  subtitlePosition: SubtitlePosition;
  durationSec: number;
  transition: RenderTransition;
  kenBurns?: KenBurnsEffect;
};

export type VisualScript = {
  creativePlanRef: string;
  video: VideoSpec;
  scenes: VisualScene[];
};

export type VisualScriptValidationResult = {
  valid: boolean;
  errors: string[];
};

export const visualScriptOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["creativePlanRef", "video", "scenes"],
  properties: {
    creativePlanRef: { type: "string", minLength: 1 },
    video: {
      type: "object",
      additionalProperties: false,
      required: ["width", "height", "fps"],
      properties: {
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
        fps: { type: "integer", minimum: 1 },
      },
    },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sceneId",
          "photoRef",
          "subtitle",
          "subtitlePosition",
          "durationSec",
          "transition",
          "kenBurns",
        ],
        properties: {
          sceneId: { type: "string", minLength: 1 },
          photoRef: { type: "string", minLength: 1 },
          subtitle: { type: "string", minLength: 1 },
          subtitlePosition: { type: "string", enum: ["bottom", "top", "center"] },
          durationSec: { type: "number", exclusiveMinimum: 0 },
          transition: {
            type: "object",
            additionalProperties: false,
            required: ["type", "durationMs", "direction"],
            properties: {
              type: { type: "string", enum: ["cut", "fade", "dissolve", "slide"] },
              durationMs: { type: "number", minimum: 0 },
              direction: { type: "string", enum: ["left", "right", "up", "down"] },
            },
          },
          kenBurns: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["startScale", "endScale", "panDirection"],
            properties: {
              startScale: { type: "number", exclusiveMinimum: 0 },
              endScale: { type: "number", exclusiveMinimum: 0 },
              panDirection: {
                type: "string",
                enum: ["left", "right", "up", "down", "center"],
              },
            },
          },
        },
      },
    },
  },
} as const;

const SUBTITLE_POSITIONS = new Set<SubtitlePosition>(["bottom", "top", "center"]);
const TRANSITION_TYPES = new Set(["cut", "fade", "dissolve", "slide"]);
const SLIDE_DIRECTIONS = new Set(["left", "right", "up", "down"]);
const PAN_DIRECTIONS = new Set(["left", "right", "up", "down", "center"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const validateVisualScript = (
  input: unknown,
): VisualScriptValidationResult & { script?: VisualScript } => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ["visual-script must be an object"] };
  }

  if (!isNonEmptyString(input.creativePlanRef)) {
    errors.push("creativePlanRef is required");
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
    errors.push("scenes must be a non-empty array");
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
      } else if (!SUBTITLE_POSITIONS.has(scene.subtitlePosition as SubtitlePosition)) {
        errors.push(`scenes[${index}].subtitlePosition must be bottom|top|center`);
      }

      if (!isFiniteNumber(scene.durationSec) || scene.durationSec <= 0) {
        errors.push(`scenes[${index}].durationSec must be > 0`);
      }

      if (!isRecord(scene.transition)) {
        errors.push(`scenes[${index}].transition is required`);
      } else {
        const transition = scene.transition;
        if (!isNonEmptyString(transition.type)) {
          errors.push(`scenes[${index}].transition.type is required`);
        } else if (!TRANSITION_TYPES.has(transition.type)) {
          errors.push(`scenes[${index}].transition.type must be cut|fade|dissolve|slide`);
        }
        if (!isFiniteNumber(transition.durationMs) || transition.durationMs < 0) {
          errors.push(`scenes[${index}].transition.durationMs must be >= 0`);
        }
        if (transition.type === "slide") {
          if (!isNonEmptyString(transition.direction)) {
            errors.push(`scenes[${index}].transition.direction is required for slide`);
          } else if (!SLIDE_DIRECTIONS.has(transition.direction)) {
            errors.push(`scenes[${index}].transition.direction must be left|right|up|down`);
          }
        }
      }

      if (scene.kenBurns !== undefined && scene.kenBurns !== null) {
        if (!isRecord(scene.kenBurns)) {
          errors.push(`scenes[${index}].kenBurns must be an object`);
        } else {
          const kenBurns = scene.kenBurns;
          if (!isFiniteNumber(kenBurns.startScale) || kenBurns.startScale <= 0) {
            errors.push(`scenes[${index}].kenBurns.startScale must be > 0`);
          }
          if (!isFiniteNumber(kenBurns.endScale) || kenBurns.endScale <= 0) {
            errors.push(`scenes[${index}].kenBurns.endScale must be > 0`);
          }
          if (!isNonEmptyString(kenBurns.panDirection)) {
            errors.push(`scenes[${index}].kenBurns.panDirection is required`);
          } else if (!PAN_DIRECTIONS.has(kenBurns.panDirection)) {
            errors.push(`scenes[${index}].kenBurns.panDirection must be left|right|up|down|center`);
          }
        }
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [], script: input as VisualScript };
};
