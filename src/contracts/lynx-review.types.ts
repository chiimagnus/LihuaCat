export type LynxReviewIssueCategory =
  | "avoidance_conflict"
  | "tone_mismatch"
  | "audience_mismatch"
  | "narrative_arc_mismatch"
  | "other";

export type LynxReviewIssue = {
  category: LynxReviewIssueCategory;
  message: string;
  evidence?: string;
  sceneId?: string;
  photoRef?: string;
  subtitle?: string;
};

export type LynxReview = {
  passed: boolean;
  summary?: string;
  issues: LynxReviewIssue[];
  requiredChanges: string[];
};

export type LynxReviewValidationResult = {
  valid: boolean;
  errors: string[];
};

