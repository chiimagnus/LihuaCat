import { z } from "zod";

const RenderTransitionSchema = z.object({
  type: z.enum(["cut", "fade", "dissolve", "slide"]),
  durationMs: z.number().min(0),
  direction: z.enum(["left", "right", "up", "down"]).optional(),
});

const KenBurnsEffectSchema = z.object({
  startScale: z.number().positive(),
  endScale: z.number().positive(),
  panDirection: z.enum(["left", "right", "up", "down", "center"]),
});

const RenderScriptTemplatePropsSchema = z.object({
  storyBriefRef: z.string().min(1),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
  }),
  assets: z
    .array(
      z.object({
        photoRef: z.string().min(1),
        path: z.string().min(1),
      }),
    )
    .min(1),
  scenes: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        photoRef: z.string().min(1),
        subtitle: z.string().min(1),
        subtitlePosition: z.enum(["bottom", "top", "center"]),
        durationSec: z.number().positive(),
        transition: RenderTransitionSchema,
        kenBurns: KenBurnsEffectSchema.optional(),
      }),
    )
    .min(1),
});

export const StoryTemplatePropsSchema = RenderScriptTemplatePropsSchema;

export type StoryTemplateProps = z.infer<typeof StoryTemplatePropsSchema>;

export const createDefaultStoryTemplateProps = (): StoryTemplateProps => ({
  storyBriefRef: "/tmp/photos/lihuacat-output/run-001/story-brief.json",
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  assets: [
    {
      photoRef: "1.jpg",
      path: "https://picsum.photos/1080/1920",
    },
  ],
  scenes: [
    {
      sceneId: "scene_001",
      photoRef: "1.jpg",
      subtitle: "LihuaCat story template",
      subtitlePosition: "bottom",
      durationSec: 30,
      transition: {
        type: "cut",
        durationMs: 0,
      },
    },
  ],
});
