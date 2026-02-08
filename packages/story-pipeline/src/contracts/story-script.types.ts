export type StoryAsset = {
  id: string;
  path: string;
};

export type StoryTimelineItem = {
  assetId: string;
  startSec: number;
  endSec: number;
  subtitleId: string;
};

export type StorySubtitle = {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
};

export type StoryScript = {
  version: string;
  input: {
    sourceDir: string;
    imageCount: number;
    assets: StoryAsset[];
  };
  video: {
    width: number;
    height: number;
    fps: number;
    durationSec: number;
  };
  style: {
    preset: string;
    prompt?: string;
  };
  timeline: StoryTimelineItem[];
  subtitles: StorySubtitle[];
  validation?: {
    allAssetsUsedAtLeastOnce?: boolean;
    minDurationPerAssetSec?: number;
    durationTotalSec?: number;
  };
};

export type StoryScriptValidationResult = {
  valid: boolean;
  errors: string[];
};
