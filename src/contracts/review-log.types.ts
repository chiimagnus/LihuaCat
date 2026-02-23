export type ReviewTarget = "kitten" | "cub";

export type ReviewIssue = {
  target: ReviewTarget;
  message: string;
};

export type ReviewRequiredChange = {
  target: ReviewTarget;
  instructions: string[];
};

export type ReviewRoundLog = {
  round: number;
  passed: boolean;
  summary: string;
  issues: ReviewIssue[];
  requiredChanges: ReviewRequiredChange[];
};

export type ReviewLog = {
  reviewer: "ocelot";
  maxRounds: number;
  finalPassed: boolean;
  warning?: string;
  rounds: ReviewRoundLog[];
};

export type ReviewLogValidationResult = {
  valid: boolean;
  errors: string[];
};

const TARGETS = new Set<ReviewTarget>(["kitten", "cub"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const validateReviewLog = (
  input: unknown,
): ReviewLogValidationResult & { reviewLog?: ReviewLog } => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ["review-log must be an object"] };
  }

  if (input.reviewer !== "ocelot") {
    errors.push("reviewer must be ocelot");
  }
  if (!isPositiveInteger(input.maxRounds)) {
    errors.push("maxRounds must be a positive integer");
  }
  if (typeof input.finalPassed !== "boolean") {
    errors.push("finalPassed must be a boolean");
  }
  if (input.warning !== undefined && !isNonEmptyString(input.warning)) {
    errors.push("warning must be a non-empty string when provided");
  }

  if (!Array.isArray(input.rounds) || input.rounds.length === 0) {
    errors.push("rounds must be a non-empty array");
  } else {
    input.rounds.forEach((round, index) => {
      if (!isRecord(round)) {
        errors.push(`rounds[${index}] must be an object`);
        return;
      }
      if (!isPositiveInteger(round.round)) {
        errors.push(`rounds[${index}].round must be a positive integer`);
      } else if (round.round !== index + 1) {
        errors.push(`rounds[${index}].round must be ${index + 1}`);
      }

      if (typeof round.passed !== "boolean") {
        errors.push(`rounds[${index}].passed must be a boolean`);
      }
      if (!isNonEmptyString(round.summary)) {
        errors.push(`rounds[${index}].summary is required`);
      }

      if (!Array.isArray(round.issues)) {
        errors.push(`rounds[${index}].issues must be an array`);
      } else {
        round.issues.forEach((issue, issueIndex) => {
          if (!isRecord(issue)) {
            errors.push(`rounds[${index}].issues[${issueIndex}] must be an object`);
            return;
          }
          if (!isNonEmptyString(issue.target)) {
            errors.push(`rounds[${index}].issues[${issueIndex}].target is required`);
          } else if (!TARGETS.has(issue.target as ReviewTarget)) {
            errors.push(
              `rounds[${index}].issues[${issueIndex}].target must be kitten|cub`,
            );
          }
          if (!isNonEmptyString(issue.message)) {
            errors.push(`rounds[${index}].issues[${issueIndex}].message is required`);
          }
        });
      }

      if (!Array.isArray(round.requiredChanges)) {
        errors.push(`rounds[${index}].requiredChanges must be an array`);
      } else {
        round.requiredChanges.forEach((change, changeIndex) => {
          if (!isRecord(change)) {
            errors.push(
              `rounds[${index}].requiredChanges[${changeIndex}] must be an object`,
            );
            return;
          }
          if (!isNonEmptyString(change.target)) {
            errors.push(
              `rounds[${index}].requiredChanges[${changeIndex}].target is required`,
            );
          } else if (!TARGETS.has(change.target as ReviewTarget)) {
            errors.push(
              `rounds[${index}].requiredChanges[${changeIndex}].target must be kitten|cub`,
            );
          }
          if (!Array.isArray(change.instructions) || change.instructions.length === 0) {
            errors.push(
              `rounds[${index}].requiredChanges[${changeIndex}].instructions must be a non-empty array`,
            );
          } else {
            change.instructions.forEach((instruction, instructionIndex) => {
              if (!isNonEmptyString(instruction)) {
                errors.push(
                  `rounds[${index}].requiredChanges[${changeIndex}].instructions[${instructionIndex}] must be a non-empty string`,
                );
              }
            });
          }
        });
      }
    });
  }

  if (
    isPositiveInteger(input.maxRounds) &&
    Array.isArray(input.rounds) &&
    input.rounds.length > input.maxRounds
  ) {
    errors.push("rounds length must not exceed maxRounds");
  }

  if (
    typeof input.finalPassed === "boolean" &&
    Array.isArray(input.rounds) &&
    input.rounds.length > 0
  ) {
    const anyPassed = input.rounds.some((round) => isRecord(round) && round.passed === true);
    if (input.finalPassed && !anyPassed) {
      errors.push("finalPassed=true requires at least one passed round");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], reviewLog: input as ReviewLog };
};

