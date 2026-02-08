export class ImageNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageNormalizationError";
  }
}

export class ImageConvertFailedError extends ImageNormalizationError {
  public readonly sourcePath: string;
  public readonly outputPath: string;
  public readonly stderr: string;

  constructor(
    sourcePath: string,
    outputPath: string,
    stderr: string,
  ) {
    super(`Failed to convert image: ${sourcePath}`);
    this.sourcePath = sourcePath;
    this.outputPath = outputPath;
    this.stderr = stderr;
    this.name = "ImageConvertFailedError";
  }
}
