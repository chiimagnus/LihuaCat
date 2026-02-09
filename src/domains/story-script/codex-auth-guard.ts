import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export class CodexAuthMissingError extends Error {
  public readonly authFilePath: string;

  constructor(authFilePath: string) {
    super(
      `Codex CLI login is required. Missing auth file: ${authFilePath}. Run 'codex login' and retry.`,
    );
    this.name = "CodexAuthMissingError";
    this.authFilePath = authFilePath;
  }
}

export type AssertCodexCliAuthenticatedInput = {
  homeDir?: string;
  accessFn?: (targetPath: string) => Promise<void>;
};

export const assertCodexCliAuthenticated = async ({
  homeDir = os.homedir(),
  accessFn = fs.access,
}: AssertCodexCliAuthenticatedInput = {}): Promise<void> => {
  const authFilePath = path.join(homeDir, ".codex", "auth.json");
  try {
    await accessFn(authFilePath);
  } catch {
    throw new CodexAuthMissingError(authFilePath);
  }
};
