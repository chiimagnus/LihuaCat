import test from "node:test";
import assert from "node:assert/strict";

import { tabbyTurnOutputSchema } from "../src/agents/tabby/tabby.schema.ts";
import { storyBriefOutputSchema } from "../src/subagents/story-brief/story-brief.schema.ts";
import { renderScriptOutputSchema } from "../src/agents/ocelot/ocelot.schema.ts";
import { lynxReviewOutputSchema } from "../src/prompts/lynx-review.prompt.ts";

test("tabby turn outputSchema keeps strict internalNotes + options bounds", () => {
  assert.deepEqual(tabbyTurnOutputSchema.required, ["say", "options", "done", "internalNotes"]);
  assert.equal(tabbyTurnOutputSchema.additionalProperties, false);

  assert.equal(tabbyTurnOutputSchema.properties.say?.type, "string");
  assert.equal(tabbyTurnOutputSchema.properties.say?.minLength, 1);

  const options = tabbyTurnOutputSchema.properties.options;
  assert.equal(options?.type, "array");
  assert.equal(options?.minItems, 2);
  assert.equal(options?.maxItems, 4);

  const optionItem = options?.items;
  assert.equal(optionItem?.type, "object");
  assert.equal(optionItem?.additionalProperties, false);
  assert.deepEqual(optionItem?.required, ["id", "label"]);
  assert.equal(optionItem?.properties.id?.type, "string");
  assert.equal(optionItem?.properties.id?.minLength, 1);
  assert.equal(optionItem?.properties.label?.type, "string");
  assert.equal(optionItem?.properties.label?.minLength, 1);

  assert.equal(tabbyTurnOutputSchema.properties.internalNotes?.type, "string");
  assert.equal(tabbyTurnOutputSchema.properties.internalNotes?.minLength, 1);
});

test("story brief outputSchema keeps non-empty strings and bounded weights", () => {
  assert.equal(storyBriefOutputSchema.type, "object");
  assert.equal(storyBriefOutputSchema.additionalProperties, false);
  assert.deepEqual(storyBriefOutputSchema.required, ["intent", "photos", "narrative"]);

  const intent = storyBriefOutputSchema.properties.intent;
  assert.equal(intent?.type, "object");
  assert.equal(intent?.additionalProperties, false);
  assert.ok(intent?.required?.includes("coreEmotion"));
  assert.equal(intent?.properties.coreEmotion?.minLength, 1);
  assert.equal(intent?.properties.tone?.minLength, 1);
  assert.equal(intent?.properties.narrativeArc?.minLength, 1);
  assert.equal(intent?.properties.rawUserWords?.minLength, 1);

  const audienceNote = intent?.properties.audienceNote;
  assert.deepEqual(audienceNote, { type: ["string", "null"] });

  const photos = storyBriefOutputSchema.properties.photos;
  assert.equal(photos?.type, "array");
  assert.equal(photos?.minItems, 1);
  const photoItem = photos?.items;
  assert.equal(photoItem?.type, "object");
  assert.equal(photoItem?.additionalProperties, false);
  assert.equal(photoItem?.properties.photoRef?.minLength, 1);
  assert.deepEqual(photoItem?.properties.suggestedRole?.enum, ["开场", "高潮", "转折", "收尾", "过渡"]);
  assert.deepEqual(photoItem?.properties.emotionalWeight, { type: "number", minimum: 0, maximum: 1 });
  assert.equal(photoItem?.properties.analysis?.minLength, 1);

  const beats = storyBriefOutputSchema.properties.narrative?.properties.beats;
  assert.equal(beats?.type, "array");
  assert.equal(beats?.minItems, 1);
  const beatItem = beats?.items;
  const photoRefs = beatItem?.properties.photoRefs;
  assert.equal(photoRefs?.type, "array");
  assert.equal(photoRefs?.minItems, 1);
  assert.equal(photoRefs?.items?.minLength, 1);
  assert.deepEqual(beatItem?.properties.duration?.enum, ["short", "medium", "long"]);
});

test("render script outputSchema keeps fixed video fields and transition variants", () => {
  assert.equal(renderScriptOutputSchema.type, "object");
  assert.equal(renderScriptOutputSchema.additionalProperties, false);
  assert.deepEqual(renderScriptOutputSchema.required, ["storyBriefRef", "video", "scenes"]);

  const video = renderScriptOutputSchema.properties.video;
  assert.equal(video?.type, "object");
  assert.equal(video?.additionalProperties, false);
  assert.deepEqual(video?.required, ["width", "height", "fps"]);
  assert.deepEqual(video?.properties.width, { type: "integer", minimum: 1 });
  assert.deepEqual(video?.properties.height, { type: "integer", minimum: 1 });
  assert.deepEqual(video?.properties.fps, { type: "integer", minimum: 1 });

  const scenes = renderScriptOutputSchema.properties.scenes;
  assert.equal(scenes?.type, "array");
  assert.equal(scenes?.minItems, 1);
  const sceneItem = scenes?.items;
  assert.equal(sceneItem?.type, "object");
  assert.equal(sceneItem?.additionalProperties, false);
  assert.equal(sceneItem?.properties.sceneId?.minLength, 1);
  assert.equal(sceneItem?.properties.photoRef?.minLength, 1);
  assert.equal(sceneItem?.properties.subtitle?.minLength, 1);
  assert.deepEqual(sceneItem?.properties.subtitlePosition?.enum, ["bottom", "top", "center"]);

  const transition = sceneItem?.properties.transition;
  assert.deepEqual(transition?.type, "object");
  assert.deepEqual(transition?.additionalProperties, false);
  assert.deepEqual(transition?.required, ["type", "durationMs", "direction"]);
  assert.deepEqual(transition?.properties.type?.enum, ["cut", "fade", "dissolve", "slide"]);
  assert.deepEqual(transition?.properties.direction?.enum, ["left", "right"]);

  assert.ok(sceneItem?.properties.kenBurns);
  assert.deepEqual(sceneItem?.required, [
    "sceneId",
    "photoRef",
    "subtitle",
    "subtitlePosition",
    "durationSec",
    "transition",
    "kenBurns",
  ]);
  assert.deepEqual(sceneItem?.properties.kenBurns?.type, ["object", "null"]);
  assert.deepEqual(sceneItem?.properties.kenBurns?.required, ["startScale", "endScale", "panDirection"]);
});

test("lynx review outputSchema stays codex-compatible and strict", () => {
  assert.equal(lynxReviewOutputSchema.type, "object");
  assert.equal(lynxReviewOutputSchema.additionalProperties, false);
  assert.deepEqual(lynxReviewOutputSchema.required, ["passed", "summary", "issues", "requiredChanges"]);

  assert.equal(lynxReviewOutputSchema.properties.passed?.type, "boolean");
  assert.equal(lynxReviewOutputSchema.properties.summary?.type, "string");

  const issues = lynxReviewOutputSchema.properties.issues;
  assert.equal(issues?.type, "array");
  const issueItem = issues?.items;
  assert.equal(issueItem?.type, "object");
  assert.equal(issueItem?.additionalProperties, false);
  assert.deepEqual(issueItem?.required, ["category", "message"]);
  assert.equal(issueItem?.properties.category?.type, "string");
  assert.equal(issueItem?.properties.message?.type, "string");
});
