import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useVideoConfig } from "remotion";

import type { StoryTemplateProps } from "./StoryComposition.schema.ts";
import { buildTemplateSequences } from "./StoryComposition.logic.ts";

export const StoryComposition: React.FC<StoryTemplateProps> = (props) => {
  const { fps } = useVideoConfig();
  const sequences = buildTemplateSequences(props, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a" }}>
      {sequences.map((sequence) => {
        return (
          <Sequence
            key={sequence.key}
            from={sequence.from}
            durationInFrames={sequence.durationInFrames}
            premountFor={fps}
          >
            <AbsoluteFill>
              <Img
                src={toRenderableAssetSrc(sequence.assetPath)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <AbsoluteFill
                style={{
                  justifyContent: "flex-end",
                  padding: "0 60px 120px",
                  background:
                    "linear-gradient(180deg, rgba(15,23,42,0) 50%, rgba(15,23,42,0.82) 100%)",
                }}
              >
                <div
                  style={{
                    color: "#e2e8f0",
                    fontFamily: "Helvetica, Arial, sans-serif",
                    fontSize: 52,
                    lineHeight: 1.3,
                    textShadow: "0 8px 24px rgba(0,0,0,0.55)",
                  }}
                >
                  {sequence.subtitle}
                </div>
              </AbsoluteFill>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const toRenderableAssetSrc = (value: string): string => {
  if (/^https?:\/\//.test(value) || value.startsWith("data:")) {
    return value;
  }
  return staticFile(value.replace(/^\/+/, ""));
};
