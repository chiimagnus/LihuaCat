import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCodexCliAuthenticated,
  CodexAuthMissingError,
} from "./codex-auth-guard.ts";

test("passes when auth file exists", async () => {
  await assert.doesNotReject(
    assertCodexCliAuthenticated({
      homeDir: "/tmp/demo-home",
      accessFn: async () => {
        return;
      },
    }),
  );
});

test("throws readable error when auth file is missing", async () => {
  await assert.rejects(
    assertCodexCliAuthenticated({
      homeDir: "/tmp/missing-home",
      accessFn: async () => {
        throw new Error("not found");
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof CodexAuthMissingError);
      assert.match(error.message, /codex login/);
      assert.match(error.authFilePath, /\.codex\/auth\.json$/);
      return true;
    },
  );
});
