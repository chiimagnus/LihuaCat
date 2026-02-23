export type CreativePlanPacing = "slow" | "medium" | "fast" | "dynamic";
export type CreativePlanBpmTrend = "up" | "down" | "steady" | "arc";

export type CreativePlanKeyMoment = {
  label: string;
  timeMs: number;
};

export type CreativePlanAlignmentPoint = {
  timeMs: number;
  visualCue: string;
  musicCue: string;
};

export type CreativePlan = {
  storyBriefRef: string;
  narrativeArc: {
    opening: string;
    development: string;
    climax: string;
    resolution: string;
  };
  visualDirection: {
    style: string;
    pacing: CreativePlanPacing;
    transitionTone: string;
    subtitleStyle: string;
  };
  musicIntent: {
    moodKeywords: string[];
    bpmTrend: CreativePlanBpmTrend;
    keyMoments: CreativePlanKeyMoment[];
    instrumentationHints: string[];
    durationMs: number;
  };
  alignmentPoints: CreativePlanAlignmentPoint[];
};

export type CreativePlanValidationResult = {
  valid: boolean;
  errors: string[];
};

const PACING_VALUES = new Set<CreativePlanPacing>(["slow", "medium", "fast", "dynamic"]);
const BPM_TREND_VALUES = new Set<CreativePlanBpmTrend>(["up", "down", "steady", "arc"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export const validateCreativePlan = (
  input: unknown,
): CreativePlanValidationResult & { plan?: CreativePlan } => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ["creative-plan must be an object"] };
  }

  if (!isNonEmptyString(input.storyBriefRef)) {
    errors.push("storyBriefRef is required");
  }

  if (!isRecord(input.narrativeArc)) {
    errors.push("narrativeArc is required");
  } else {
    const arc = input.narrativeArc;
    if (!isNonEmptyString(arc.opening)) errors.push("narrativeArc.opening is required");
    if (!isNonEmptyString(arc.development)) errors.push("narrativeArc.development is required");
    if (!isNonEmptyString(arc.climax)) errors.push("narrativeArc.climax is required");
    if (!isNonEmptyString(arc.resolution)) errors.push("narrativeArc.resolution is required");
  }

  if (!isRecord(input.visualDirection)) {
    errors.push("visualDirection is required");
  } else {
    const visual = input.visualDirection;
    if (!isNonEmptyString(visual.style)) errors.push("visualDirection.style is required");
    if (!isNonEmptyString(visual.pacing)) {
      errors.push("visualDirection.pacing is required");
    } else if (!PACING_VALUES.has(visual.pacing as CreativePlanPacing)) {
      errors.push("visualDirection.pacing must be slow|medium|fast|dynamic");
    }
    if (!isNonEmptyString(visual.transitionTone)) {
      errors.push("visualDirection.transitionTone is required");
    }
    if (!isNonEmptyString(visual.subtitleStyle)) {
      errors.push("visualDirection.subtitleStyle is required");
    }
  }

  if (!isRecord(input.musicIntent)) {
    errors.push("musicIntent is required");
  } else {
    const music = input.musicIntent;

    if (!Array.isArray(music.moodKeywords) || music.moodKeywords.length === 0) {
      errors.push("musicIntent.moodKeywords must be a non-empty array");
    } else {
      music.moodKeywords.forEach((item, index) => {
        if (!isNonEmptyString(item)) {
          errors.push(`musicIntent.moodKeywords[${index}] must be a non-empty string`);
        }
      });
    }

    if (!isNonEmptyString(music.bpmTrend)) {
      errors.push("musicIntent.bpmTrend is required");
    } else if (!BPM_TREND_VALUES.has(music.bpmTrend as CreativePlanBpmTrend)) {
      errors.push("musicIntent.bpmTrend must be up|down|steady|arc");
    }

    if (!isPositiveInteger(music.durationMs)) {
      errors.push("musicIntent.durationMs must be a positive integer");
    }

    if (!Array.isArray(music.instrumentationHints)) {
      errors.push("musicIntent.instrumentationHints must be an array");
    } else {
      music.instrumentationHints.forEach((hint, index) => {
        if (!isNonEmptyString(hint)) {
          errors.push(`musicIntent.instrumentationHints[${index}] must be a non-empty string`);
        }
      });
    }

    if (!Array.isArray(music.keyMoments) || music.keyMoments.length === 0) {
      errors.push("musicIntent.keyMoments must be a non-empty array");
    } else {
      music.keyMoments.forEach((moment, index) => {
        if (!isRecord(moment)) {
          errors.push(`musicIntent.keyMoments[${index}] must be an object`);
          return;
        }
        if (!isNonEmptyString(moment.label)) {
          errors.push(`musicIntent.keyMoments[${index}].label is required`);
        }
        if (!isNonNegativeInteger(moment.timeMs)) {
          errors.push(`musicIntent.keyMoments[${index}].timeMs must be >= 0 integer`);
        }
        if (
          isPositiveInteger(music.durationMs) &&
          isNonNegativeInteger(moment.timeMs) &&
          moment.timeMs > music.durationMs
        ) {
          errors.push(`musicIntent.keyMoments[${index}].timeMs must be <= durationMs`);
        }
      });
    }
  }

  if (!Array.isArray(input.alignmentPoints)) {
    errors.push("alignmentPoints must be an array");
  } else {
    input.alignmentPoints.forEach((point, index) => {
      if (!isRecord(point)) {
        errors.push(`alignmentPoints[${index}] must be an object`);
        return;
      }
      if (!isNonNegativeInteger(point.timeMs)) {
        errors.push(`alignmentPoints[${index}].timeMs must be >= 0 integer`);
      }
      if (!isNonEmptyString(point.visualCue)) {
        errors.push(`alignmentPoints[${index}].visualCue is required`);
      }
      if (!isNonEmptyString(point.musicCue)) {
        errors.push(`alignmentPoints[${index}].musicCue is required`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], plan: input as CreativePlan };
};

