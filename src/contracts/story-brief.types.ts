export type StoryBrief = {
  intent: CreativeIntent;
  photos: PhotoNote[];
  narrative: NarrativeStructure;
};

export type CreativeIntent = {
  coreEmotion: string;
  tone: string;
  narrativeArc: string;
  audienceNote: string | null;
  avoidance: string[];
  rawUserWords: string;
};

export type PhotoNote = {
  photoRef: string;
  userSaid: string;
  emotionalWeight: number; // 0..1
  suggestedRole: "开场" | "高潮" | "转折" | "收尾" | "过渡";
  backstory: string;
  analysis: string;
};

export type NarrativeStructure = {
  arc: string;
  beats: StoryBeat[];
};

export type StoryBeat = {
  photoRefs: string[];
  moment: string;
  emotion: string;
  duration: "short" | "medium" | "long";
  transition: string;
};

export type StoryBriefValidationResult = {
  valid: boolean;
  errors: string[];
};

