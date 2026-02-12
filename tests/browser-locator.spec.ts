import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import {
  BrowserExecutableNotFoundError,
  listAvailableBrowserExecutables,
  locateBrowserExecutable,
} from "../src/domains/template-render/browser-locator.ts";

test("returns preferred executable when provided and existing", async () => {
  const preferred = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
  const result = await locateBrowserExecutable({
    preferredPath: preferred,
    existsFn: async (value) => value === preferred,
  });

  assert.equal(result.browser, "edge");
  assert.equal(result.executablePath, preferred);
});

test("finds Arc from known macOS locations", async () => {
  const arcPath = "/Applications/Arc.app/Contents/MacOS/Arc";
  const result = await locateBrowserExecutable({
    existsFn: async (value) => value === arcPath,
  });

  assert.equal(result.browser, "arc");
  assert.equal(result.executablePath, arcPath);
});

test("finds Brave in user Applications folder", async () => {
  const bravePath = path.join(
    os.homedir(),
    "Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  );
  const result = await locateBrowserExecutable({
    existsFn: async (value) => value === bravePath,
  });

  assert.equal(result.browser, "brave");
  assert.equal(result.executablePath, bravePath);
});

test("throws readable error when no browser executable is found", async () => {
  await assert.rejects(
    locateBrowserExecutable({
      existsFn: async () => false,
    }),
    (error: unknown) => {
      assert.ok(error instanceof BrowserExecutableNotFoundError);
      assert.ok(error.triedPaths.length >= 4);
      assert.match(error.message, /Chrome\/Edge\/Arc\/Brave/);
      return true;
    },
  );
});

test("lists detected browser executables in scan order", async () => {
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const bravePath = path.join(
    os.homedir(),
    "Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  );
  const result = await listAvailableBrowserExecutables({
    existsFn: async (value) => value === chromePath || value === bravePath,
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => item.browser),
    ["chrome", "brave"],
  );
  assert.deepEqual(
    result.map((item) => item.executablePath),
    [chromePath, bravePath],
  );
});
