#!/usr/bin/env node

import { runRenderStoryCommand } from "./app/tui/render-story.command.ts";

const main = async () => {
  const exitCode = await runRenderStoryCommand({
    argv: process.argv.slice(2),
  });
  process.exitCode = exitCode;
};

void main();
