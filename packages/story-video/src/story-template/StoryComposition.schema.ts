import { z } from "zod";

export const StoryTemplatePropsSchema = z.object({
  version: z.string().min(1),
  input: z.object({
    sourceDir: z.string().min(1),
    imageCount: z.number().int().positive(),
    assets: z
      .array(
        z.object({
          id: z.string().min(1),
          path: z.string().min(1),
        }),
      )
      .min(1),
  }),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    durationSec: z.number().positive(),
  }),
  style: z.object({
    preset: z.string().min(1),
    prompt: z.string().optional(),
  }),
  timeline: z
    .array(
      z.object({
        assetId: z.string().min(1),
        startSec: z.number().min(0),
        endSec: z.number().positive(),
        subtitleId: z.string().min(1),
      }),
    )
    .min(1),
  subtitles: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        startSec: z.number().min(0),
        endSec: z.number().positive(),
      }),
    )
    .min(1),
});

export type StoryTemplateProps = z.infer<typeof StoryTemplatePropsSchema>;

export const createDefaultStoryTemplateProps = (): StoryTemplateProps => ({
  version: "1.0",
  input: {
    sourceDir: "/tmp/photos",
    imageCount: 1,
    assets: [
      {
        id: "img_001",
        path: "https://picsum.photos/1080/1920",
      },
    ],
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationSec: 30,
  },
  style: {
    preset: "healing",
  },
  timeline: [
    {
      assetId: "img_001",
      startSec: 0,
      endSec: 30,
      subtitleId: "sub_001",
    },
  ],
  subtitles: [
    {
      id: "sub_001",
      text: "LihuaCat story template",
      startSec: 0,
      endSec: 30,
    },
  ],
});
