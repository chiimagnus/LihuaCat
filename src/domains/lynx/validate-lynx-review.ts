import type {
  LynxReview,
  LynxReviewValidationResult,
  LynxReviewIssueCategory,
} from "../../contracts/lynx-review.types.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const ISSUE_CATEGORIES = new Set<LynxReviewIssueCategory>([
  "avoidance_conflict",
  "tone_mismatch",
  "audience_mismatch",
  "narrative_arc_mismatch",
  "other",
]);

export const validateLynxReviewStructure = (
  input: unknown,
): LynxReviewValidationResult & { review?: LynxReview } => {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["lynx review must be an object"] };
  }

  if (typeof input.passed !== "boolean") {
    errors.push("passed is required");
  }

  if (input.summary !== undefined && !isNonEmptyString(input.summary)) {
    errors.push("summary must be a non-empty string when present");
  }

  if (!Array.isArray(input.issues)) {
    errors.push("issues is required");
  } else {
    input.issues.forEach((issue, index) => {
      if (!isRecord(issue)) {
        errors.push(`issues[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(issue.category)) {
        errors.push(`issues[${index}].category is required`);
      } else if (!ISSUE_CATEGORIES.has(issue.category as LynxReviewIssueCategory)) {
        errors.push(`issues[${index}].category is invalid`);
      }
      if (!isNonEmptyString(issue.message)) {
        errors.push(`issues[${index}].message is required`);
      }
      if (issue.evidence !== undefined && !isNonEmptyString(issue.evidence)) {
        errors.push(`issues[${index}].evidence must be non-empty when present`);
      }
      if (issue.sceneId !== undefined && !isNonEmptyString(issue.sceneId)) {
        errors.push(`issues[${index}].sceneId must be non-empty when present`);
      }
      if (issue.photoRef !== undefined && !isNonEmptyString(issue.photoRef)) {
        errors.push(`issues[${index}].photoRef must be non-empty when present`);
      }
      if (issue.subtitle !== undefined && !isNonEmptyString(issue.subtitle)) {
        errors.push(`issues[${index}].subtitle must be non-empty when present`);
      }
    });
  }

  if (!Array.isArray(input.requiredChanges)) {
    errors.push("requiredChanges is required");
  } else {
    input.requiredChanges.forEach((change, index) => {
      if (!isNonEmptyString(change)) {
        errors.push(`requiredChanges[${index}] must be a non-empty string`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], review: input as LynxReview };
};
