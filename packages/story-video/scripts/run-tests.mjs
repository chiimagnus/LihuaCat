import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const files = args.length > 0 ? args : findSpecFiles(path.resolve("src"));

if (files.length === 0) {
  console.log("No test files found.");
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", ...files],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);

function findSpecFiles(rootDir) {
  const collected = [];
  walk(rootDir, collected);
  return collected;
}

function walk(dir, collected) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, collected);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      collected.push(entryPath);
    }
  }
}
