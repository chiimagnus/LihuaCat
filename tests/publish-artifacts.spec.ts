import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { publishArtifacts } from "../src/tools/artifacts/publish-artifacts.ts";

test("publishes artifacts and returns summary with key paths", async () => {
  await withTempDir(async (outputDir) => {
    const videoPath = path.join(outputDir, "video.mp4");
    await fs.writeFile(videoPath, "video");

    const storyBriefPath = path.join(outputDir, "story-brief.json");
    const creativePlanPath = path.join(outputDir, "creative-plan.json");
    const visualScriptPath = path.join(outputDir, "visual-script.json");
    const reviewLogPath = path.join(outputDir, "review-log.json");
    const midiJsonPath = path.join(outputDir, "music-json.json");
    const musicMidPath = path.join(outputDir, "music.mid");
    const musicWavPath = path.join(outputDir, "music.wav");
    const renderScriptPath = path.join(outputDir, "render-script.json");
    const tabbyConversationPath = path.join(outputDir, "tabby-conversation.jsonl");
    const ocelotInputPath = path.join(outputDir, "ocelot-input.json");
    const ocelotOutputPath = path.join(outputDir, "ocelot-output.json");
    const ocelotPromptLogPath = path.join(outputDir, "ocelot-prompt.log");
    await fs.writeFile(storyBriefPath, JSON.stringify({ ok: true }), "utf8");
    await fs.writeFile(creativePlanPath, JSON.stringify({ ok: true }), "utf8");
    await fs.writeFile(visualScriptPath, JSON.stringify({ ok: true }), "utf8");
    await fs.writeFile(reviewLogPath, JSON.stringify({ ok: true }), "utf8");
    await fs.writeFile(midiJsonPath, JSON.stringify({ ok: true }), "utf8");
    await fs.writeFile(musicMidPath, "mid", "utf8");
    await fs.writeFile(musicWavPath, "wav", "utf8");
    await fs.writeFile(renderScriptPath, JSON.stringify({ ok: true }), "utf8");
    await fs.writeFile(tabbyConversationPath, "", "utf8");
    await fs.writeFile(ocelotInputPath, "{}", "utf8");
    await fs.writeFile(ocelotOutputPath, "{}", "utf8");
    await fs.writeFile(ocelotPromptLogPath, "prompt", "utf8");

    const summary = await publishArtifacts({
      runId: "run-001",
      outputDir,
      videoPath,
      storyBriefPath,
      creativePlanPath,
      visualScriptPath,
      reviewLogPath,
      midiJsonPath,
      musicMidPath,
      musicWavPath,
      renderScriptPath,
      tabbyConversationPath,
      ocelotInputPath,
      ocelotOutputPath,
      ocelotPromptLogPath,
      lynxReviewPaths: [],
      lynxPromptLogPaths: [],
      ocelotRevisionPaths: [],
      runLogs: ["run started", "run succeeded"],
    });

    assert.equal(summary.videoPath, videoPath);
    assert.ok(summary.storyBriefPath.endsWith("story-brief.json"));
    assert.ok(summary.creativePlanPath?.endsWith("creative-plan.json"));
    assert.ok(summary.visualScriptPath?.endsWith("visual-script.json"));
    assert.ok(summary.reviewLogPath?.endsWith("review-log.json"));
    assert.ok(summary.musicMidPath?.endsWith("music.mid"));
    assert.ok(summary.musicWavPath?.endsWith("music.wav"));
    assert.ok(summary.renderScriptPath.endsWith("render-script.json"));
    assert.ok(summary.tabbyConversationPath.endsWith("tabby-conversation.jsonl"));
    assert.ok(summary.runLogPath.endsWith("run.log"));
    await assert.doesNotReject(fs.access(summary.storyBriefPath));
    await assert.doesNotReject(fs.access(summary.renderScriptPath));
    await assert.doesNotReject(fs.access(summary.tabbyConversationPath));
    await assert.doesNotReject(fs.access(summary.runLogPath));
  });
});

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-artifacts-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
