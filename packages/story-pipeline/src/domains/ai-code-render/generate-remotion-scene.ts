import type { StoryScript } from "../../contracts/story-script.types.ts";

export type GenerateRemotionSceneInput = {
  storyScript: StoryScript;
};

export const generateRemotionScene = ({
  storyScript,
}: GenerateRemotionSceneInput): string => {
  const assetPathById = Object.fromEntries(
    storyScript.input.assets.map((asset) => [
      asset.id,
      asset.path,
    ]),
  );
  const subtitleById = Object.fromEntries(
    storyScript.subtitles.map((subtitle) => [subtitle.id, subtitle.text]),
  );

  const scenes = storyScript.timeline.map((item, index) => ({
    key: `${item.assetId}_${index}`,
    from: Math.max(0, Math.round(item.startSec * storyScript.video.fps)),
    durationInFrames: Math.max(
      1,
      Math.round((item.endSec - item.startSec) * storyScript.video.fps),
    ),
    assetPath: assetPathById[item.assetId] ?? "",
    subtitle: subtitleById[item.subtitleId] ?? "",
  }));

  return `import React from "react";
import { AbsoluteFill, Img, Sequence } from "remotion";

const scenes = ${JSON.stringify(scenes, null, 2)};

export const GeneratedScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#111827" }}>
      {scenes.map((scene) => {
        return (
          <Sequence
            key={scene.key}
            from={scene.from}
            durationInFrames={scene.durationInFrames}
            premountFor={30}
          >
            <AbsoluteFill>
              <Img
                src={scene.assetPath}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <AbsoluteFill
                style={{
                  justifyContent: "flex-end",
                  padding: "0 60px 120px",
                  background:
                    "linear-gradient(180deg, rgba(17,24,39,0) 45%, rgba(17,24,39,0.9) 100%)",
                }}
              >
                <div
                  style={{
                    color: "#f8fafc",
                    fontFamily: "Helvetica, Arial, sans-serif",
                    fontSize: 52,
                    lineHeight: 1.3,
                    textShadow: "0 8px 20px rgba(0,0,0,0.55)",
                  }}
                >
                  {scene.subtitle}
                </div>
              </AbsoluteFill>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
`;
};
