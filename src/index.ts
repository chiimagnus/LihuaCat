import { runRenderStoryCommand } from "./commands/render-story.command.ts";

const main = async () => {
  const exitCode = await runRenderStoryCommand({
    argv: process.argv.slice(2),
  });
  process.exitCode = exitCode;
};

void main();
