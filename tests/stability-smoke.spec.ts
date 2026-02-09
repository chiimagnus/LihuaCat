import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";

test("stability script prints summary format", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const scriptPath = path.join(repoRoot, "tests/stability-run.sh");
  const fixtureDir = path.join(repoRoot, "tests");

  const result = await runCommand("bash", [scriptPath, fixtureDir], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LIHUACAT_STABILITY_RUNS: "0",
    },
  });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /STABILITY_RESULT success=\d+ fail=\d+ success_rate=\d+(?:\.\d+)?% runs=0/);
});

const runCommand = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
): Promise<{ exitCode: number; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
