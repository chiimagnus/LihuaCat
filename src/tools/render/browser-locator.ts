import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type SupportedBrowser = "chrome" | "edge" | "brave";

export type BrowserCandidate = {
  browser: SupportedBrowser;
  executablePath: string;
};

export class BrowserExecutableNotFoundError extends Error {
  public readonly triedPaths: string[];

  constructor(triedPaths: string[]) {
    super(
      `No supported Chromium browser found. Tried: ${triedPaths.join(", ")}. Install Chrome/Edge/Brave or pass --browser-executable.`,
    );
    this.name = "BrowserExecutableNotFoundError";
    this.triedPaths = triedPaths;
  }
}

export type LocateBrowserExecutableInput = {
  preferredPath?: string;
  existsFn?: (value: string) => Promise<boolean>;
};

export type ListAvailableBrowserExecutablesInput = {
  existsFn?: (value: string) => Promise<boolean>;
};

const browserRelativePaths: Record<SupportedBrowser, string> = {
  chrome: "Google Chrome.app/Contents/MacOS/Google Chrome",
  edge: "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  brave: "Brave Browser.app/Contents/MacOS/Brave Browser",
};

export const locateBrowserExecutable = async ({
  preferredPath,
  existsFn = fileExists,
}: LocateBrowserExecutableInput = {}): Promise<BrowserCandidate> => {
  if (preferredPath) {
    const resolved = path.resolve(preferredPath);
    if (await existsFn(resolved)) {
      return {
        browser: inferBrowserName(resolved),
        executablePath: resolved,
      };
    }
    throw new BrowserExecutableNotFoundError([resolved]);
  }

  const candidates = buildKnownCandidates();

  const triedPaths: string[] = [];
  for (const candidate of candidates) {
    triedPaths.push(candidate.executablePath);
    if (await existsFn(candidate.executablePath)) {
      return candidate;
    }
  }

  throw new BrowserExecutableNotFoundError(triedPaths);
};

export const listAvailableBrowserExecutables = async ({
  existsFn = fileExists,
}: ListAvailableBrowserExecutablesInput = {}): Promise<BrowserCandidate[]> => {
  const candidates = buildKnownCandidates();
  const found: BrowserCandidate[] = [];
  for (const candidate of candidates) {
    if (await existsFn(candidate.executablePath)) {
      found.push(candidate);
    }
  }
  return found;
};

const inferBrowserName = (executablePath: string): SupportedBrowser => {
  const lower = executablePath.toLowerCase();
  if (lower.includes("microsoft edge")) {
    return "edge";
  }
  if (lower.includes("brave")) {
    return "brave";
  }
  return "chrome";
};

const fileExists = async (value: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(value);
    return stat.isFile();
  } catch {
    return false;
  }
};

const buildKnownCandidates = (): BrowserCandidate[] => {
  const appRoots = ["/Applications", path.join(os.homedir(), "Applications")];
  const candidates: BrowserCandidate[] = [];
  for (const appRoot of appRoots) {
    for (const browser of ["chrome", "edge", "brave"] as const) {
      candidates.push({
        browser,
        executablePath: path.join(appRoot, browserRelativePaths[browser]),
      });
    }
  }
  return candidates;
};

