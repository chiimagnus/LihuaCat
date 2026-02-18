import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, type ChromiumOptions } from "@remotion/renderer";

export type LihuaCatRemotionRenderTuning = {
  /**
   * Remotion renders video frames as images first.
   * Defaulting to PNG reduces per-frame JPEG artifact flicker at the cost of render speed.
   */
  imageFormat: "jpeg" | "png";
  chromiumOptions: ChromiumOptions;
  concurrency?: number;
};

const validOpenGlRenderers = [
  "swangle",
  "angle",
  "egl",
  "swiftshader",
  "vulkan",
  "angle-egl",
] as const;

export const getLihuaCatRemotionRenderTuning = (
  env: NodeJS.ProcessEnv = process.env,
): LihuaCatRemotionRenderTuning => {
  const imageFormat = parseImageFormatEnv(env.LIHUACAT_RENDER_IMAGE_FORMAT);
  const gl = parseGlEnv(env.LIHUACAT_RENDER_GL);
  const concurrency = parseConcurrencyEnv(env.LIHUACAT_RENDER_CONCURRENCY);

  const chromiumOptions: ChromiumOptions = {};
  if (gl !== undefined) {
    chromiumOptions.gl = gl;
  }

  return {
    imageFormat,
    chromiumOptions,
    concurrency,
  };
};

export type BundleRemotionEntryInput = {
  entryPoint: string;
  publicDir?: string;
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
  "Automatic browser download is disabled. Install Chrome/Edge/Brave locally or pass --browser-executable.";

export const bundleRemotionEntry = async ({
  entryPoint,
  publicDir,
}: BundleRemotionEntryInput): Promise<string> => {
  try {
    return await bundle({
      entryPoint,
      publicDir,
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

  const tuning = getLihuaCatRemotionRenderTuning();

  let composition;
  try {
    composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps,
      browserExecutable: browserExecutablePath,
      onBrowserDownload,
      chromeMode: "chrome-for-testing",
      logLevel: "error",
      chromiumOptions: tuning.chromiumOptions,
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
      imageFormat: tuning.imageFormat,
      outputLocation: outputFilePath,
      browserExecutable: browserExecutablePath,
      onBrowserDownload,
      chromeMode: "chrome-for-testing",
      logLevel: "error",
      overwrite: true,
      chromiumOptions: tuning.chromiumOptions,
      concurrency: tuning.concurrency,
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

const parseImageFormatEnv = (raw: string | undefined): "jpeg" | "png" => {
  if (!raw) return "png";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "png" || normalized === "jpeg") {
    return normalized;
  }
  throw new Error(
    `Invalid LIHUACAT_RENDER_IMAGE_FORMAT: ${raw}. Expected "png" or "jpeg".`,
  );
};

const parseGlEnv = (
  raw: string | undefined,
): LihuaCatRemotionRenderTuning["chromiumOptions"]["gl"] | undefined => {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "null" || normalized === "default" || normalized === "auto") {
    return undefined;
  }
  if ((validOpenGlRenderers as readonly string[]).includes(normalized)) {
    return normalized as (typeof validOpenGlRenderers)[number];
  }
  throw new Error(
    `Invalid LIHUACAT_RENDER_GL: ${raw}. Expected one of: ${validOpenGlRenderers.join(", ")} (or "auto").`,
  );
};

const parseConcurrencyEnv = (raw: string | undefined): number | undefined => {
  // Remotion can render frames with multiple pages concurrently.
  // In our use case (short story template), the safest default is to disable frame concurrency
  // to avoid rare black-frame glitches in the produced video.
  if (!raw) return 1;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "null" || normalized === "default" || normalized === "auto") {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid LIHUACAT_RENDER_CONCURRENCY: ${raw}. Expected a positive integer (or "auto").`,
    );
  }
  return parsed;
};
