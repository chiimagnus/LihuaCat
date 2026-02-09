import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

export type BundleRemotionEntryInput = {
  entryPoint: string;
};

export type RenderRemotionVideoInput = {
  serveUrl: string;
  compositionId: string;
  inputProps: Record<string, unknown>;
  outputFilePath: string;
  browserExecutablePath: string;
};

export class RemotionRenderError extends Error {
  public readonly stage: "bundle" | "select-composition" | "render";
  public readonly details?: string;

  constructor(
    stage: "bundle" | "select-composition" | "render",
    message: string,
    details?: string,
  ) {
    super(message);
    this.name = "RemotionRenderError";
    this.stage = stage;
    this.details = details;
  }
}

const browserDownloadDisabledMessage =
  "Automatic browser download is disabled. Install Chrome/Edge/Arc/Brave locally or pass --browser-executable.";

export const bundleRemotionEntry = async ({
  entryPoint,
}: BundleRemotionEntryInput): Promise<string> => {
  try {
    return await bundle({
      entryPoint,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof Error ? error.stack : undefined;
    throw new RemotionRenderError(
      "bundle",
      `Remotion bundle failed: ${message}`,
      details,
    );
  }
};

export const renderRemotionVideo = async ({
  serveUrl,
  compositionId,
  inputProps,
  outputFilePath,
  browserExecutablePath,
}: RenderRemotionVideoInput): Promise<void> => {
  const onBrowserDownload = () => {
    throw new Error(browserDownloadDisabledMessage);
  };

  let composition;
  try {
    composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps,
      browserExecutable: browserExecutablePath,
      onBrowserDownload,
      logLevel: "error",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof Error ? error.stack : undefined;
    throw new RemotionRenderError(
      "select-composition",
      `Select composition failed: ${message}`,
      details,
    );
  }

  try {
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      outputLocation: outputFilePath,
      browserExecutable: browserExecutablePath,
      onBrowserDownload,
      logLevel: "error",
      overwrite: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof Error ? error.stack : undefined;
    throw new RemotionRenderError(
      "render",
      `Render video failed: ${message}`,
      details,
    );
  }
};
