import type {
  StoryBrief,
  StoryBriefValidationResult,
} from "../../contracts/story-brief.types.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export type StoryBriefValidationRules = {
  expectedPhotoCount?: number;
};

export const validateStoryBriefStructure = (
  input: unknown,
  rules: StoryBriefValidationRules = {},
): StoryBriefValidationResult & { brief?: StoryBrief } => {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["story-brief must be an object"] };
  }

  if (!isRecord(input.intent)) {
    errors.push("intent is required");
  } else {
    const intent = input.intent;
    if (!isNonEmptyString(intent.coreEmotion)) errors.push("intent.coreEmotion is required");
    if (!isNonEmptyString(intent.tone)) errors.push("intent.tone is required");
    if (!isNonEmptyString(intent.narrativeArc)) errors.push("intent.narrativeArc is required");
    const audienceNote = intent.audienceNote;
    if (audienceNote !== null && audienceNote !== undefined && !isNonEmptyString(audienceNote)) {
      errors.push("intent.audienceNote must be string or null");
    }
    if (!Array.isArray(intent.avoidance)) {
      errors.push("intent.avoidance is required");
    } else {
      intent.avoidance.forEach((item, index) => {
        if (!isNonEmptyString(item)) {
          errors.push(`intent.avoidance[${index}] must be a non-empty string`);
        }
      });
    }
    if (!isNonEmptyString(intent.rawUserWords)) errors.push("intent.rawUserWords is required");
  }

  if (!Array.isArray(input.photos)) {
    errors.push("photos is required");
  } else {
    if (rules.expectedPhotoCount !== undefined && input.photos.length !== rules.expectedPhotoCount) {
      errors.push(`photos length must be ${rules.expectedPhotoCount}, got ${input.photos.length}`);
    }

    input.photos.forEach((photo, index) => {
      if (!isRecord(photo)) {
        errors.push(`photos[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(photo.photoRef)) errors.push(`photos[${index}].photoRef is required`);
      if (photo.userSaid !== undefined && !isNonEmptyString(photo.userSaid)) {
        errors.push(`photos[${index}].userSaid must be a non-empty string`);
      }
      if (!isFiniteNumber(photo.emotionalWeight) || photo.emotionalWeight < 0 || photo.emotionalWeight > 1) {
        errors.push(`photos[${index}].emotionalWeight must be between 0 and 1`);
      }
      if (!isNonEmptyString(photo.suggestedRole)) errors.push(`photos[${index}].suggestedRole is required`);
      if (photo.backstory !== undefined && !isNonEmptyString(photo.backstory)) {
        errors.push(`photos[${index}].backstory must be a non-empty string`);
      }
      if (!isNonEmptyString(photo.analysis)) errors.push(`photos[${index}].analysis is required`);
    });
  }

  if (!isRecord(input.narrative)) {
    errors.push("narrative is required");
  } else {
    const narrative = input.narrative;
    if (!isNonEmptyString(narrative.arc)) errors.push("narrative.arc is required");
    if (!Array.isArray(narrative.beats) || narrative.beats.length === 0) {
      errors.push("narrative.beats is required");
    } else {
      narrative.beats.forEach((beat, index) => {
        if (!isRecord(beat)) {
          errors.push(`narrative.beats[${index}] must be an object`);
          return;
        }
        if (!Array.isArray(beat.photoRefs) || beat.photoRefs.length === 0) {
          errors.push(`narrative.beats[${index}].photoRefs is required`);
        } else {
          beat.photoRefs.forEach((ref, refIndex) => {
            if (!isNonEmptyString(ref)) {
              errors.push(`narrative.beats[${index}].photoRefs[${refIndex}] must be a non-empty string`);
            }
          });
        }
        if (!isNonEmptyString(beat.moment)) errors.push(`narrative.beats[${index}].moment is required`);
        if (!isNonEmptyString(beat.emotion)) errors.push(`narrative.beats[${index}].emotion is required`);
        if (!isNonEmptyString(beat.duration)) errors.push(`narrative.beats[${index}].duration is required`);
        if (!isNonEmptyString(beat.transition)) errors.push(`narrative.beats[${index}].transition is required`);
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], brief: input as StoryBrief };
};

