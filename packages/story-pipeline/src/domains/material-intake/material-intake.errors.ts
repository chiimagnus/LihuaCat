export class MaterialIntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialIntakeError";
  }
}

export class SourceDirectoryNotFoundError extends MaterialIntakeError {
  public readonly sourceDir: string;

  constructor(sourceDir: string) {
    super(`Source directory does not exist: ${sourceDir}`);
    this.sourceDir = sourceDir;
    this.name = "SourceDirectoryNotFoundError";
  }
}

export class NoSupportedImagesError extends MaterialIntakeError {
  public readonly sourceDir: string;

  constructor(sourceDir: string) {
    super(`No supported images found in directory: ${sourceDir}`);
    this.sourceDir = sourceDir;
    this.name = "NoSupportedImagesError";
  }
}

export class TooManyImagesError extends MaterialIntakeError {
  public readonly maxImages: number;
  public readonly actualImages: number;

  constructor(
    maxImages: number,
    actualImages: number,
  ) {
    super(`Too many images: max ${maxImages}, got ${actualImages}`);
    this.maxImages = maxImages;
    this.actualImages = actualImages;
    this.name = "TooManyImagesError";
  }
}

export class UnsupportedImageFormatError extends MaterialIntakeError {
  public readonly fileNames: string[];

  constructor(fileNames: string[]) {
    super(`Unsupported image format: ${fileNames.join(", ")}`);
    this.fileNames = fileNames;
    this.name = "UnsupportedImageFormatError";
  }
}
