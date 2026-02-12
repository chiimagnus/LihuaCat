#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent ?? "";
const isPnpm = userAgent.startsWith("pnpm/");

if (isPnpm) {
  process.exit(0);
}

const message = [
  "This repository uses pnpm for development.",
  "Please run: pnpm install",
].join("\n");

console.error(message);
process.exit(1);
