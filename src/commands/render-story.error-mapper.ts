type StoryScriptGenerationFailedLike = {
  reasons: string[];
};

type ErrorClass<T> = new (...args: never[]) => T;

export const buildRenderFailureOutput = ({
  error,
  StoryScriptGenerationFailedErrorClass,
  SourceDirectoryNotFoundErrorClass,
}: {
  error: unknown;
  StoryScriptGenerationFailedErrorClass: ErrorClass<StoryScriptGenerationFailedLike>;
  SourceDirectoryNotFoundErrorClass: ErrorClass<object>;
}): { lines: string[] } => {
  const message = error instanceof Error ? error.message : String(error);
  const lines: string[] = [`Render failed: ${message}`];

  if (
    error instanceof StoryScriptGenerationFailedErrorClass &&
    error.reasons.length > 0
  ) {
    lines.push("Story script generation failure details:");
    for (const reason of error.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  if (error instanceof SourceDirectoryNotFoundErrorClass) {
    lines.push(
      "Input tip: provide one directory path, e.g. --input /Users/<you>/Downloads/photos",
    );
  }

  return { lines };
};
