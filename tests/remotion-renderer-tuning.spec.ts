import test from "node:test";
import assert from "node:assert/strict";

import { getLihuaCatRemotionRenderTuning } from "../src/domains/template-render/remotion-renderer.ts";

test("remotion tuning defaults to png frames", () => {
  const tuning = getLihuaCatRemotionRenderTuning({});
  assert.equal(tuning.imageFormat, "png");
  assert.equal(tuning.concurrency, 1);
});

test("remotion tuning accepts jpeg frames", () => {
  const tuning = getLihuaCatRemotionRenderTuning({
    LIHUACAT_RENDER_IMAGE_FORMAT: "jpeg",
  });
  assert.equal(tuning.imageFormat, "jpeg");
});

test("remotion tuning accepts gl renderer", () => {
  const tuning = getLihuaCatRemotionRenderTuning({
    LIHUACAT_RENDER_GL: "swangle",
  });
  assert.equal(tuning.chromiumOptions.gl, "swangle");
});

test("remotion tuning accepts explicit concurrency", () => {
  const tuning = getLihuaCatRemotionRenderTuning({
    LIHUACAT_RENDER_CONCURRENCY: "1",
  });
  assert.equal(tuning.concurrency, 1);
});

test("remotion tuning throws on invalid gl renderer", () => {
  assert.throws(
    () =>
      getLihuaCatRemotionRenderTuning({
        LIHUACAT_RENDER_GL: "nope",
      }),
    /Invalid LIHUACAT_RENDER_GL/,
  );
});
