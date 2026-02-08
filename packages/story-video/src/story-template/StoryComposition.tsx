export type StoryTemplateProps = {
  timeline: Array<{
    assetId: string;
    startSec: number;
    endSec: number;
    subtitleId: string;
  }>;
  subtitles: Array<{
    id: string;
    text: string;
    startSec: number;
    endSec: number;
  }>;
  video: {
    width: number;
    height: number;
    fps: number;
    durationSec: number;
  };
};

export const buildTemplateRenderPlan = (props: StoryTemplateProps) => {
  return {
    mode: "template",
    sceneCount: props.timeline.length,
    subtitleCount: props.subtitles.length,
    durationSec: props.video.durationSec,
    frameCount: props.video.durationSec * props.video.fps,
  };
};
