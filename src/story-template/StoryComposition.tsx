import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import type { StoryTemplateProps } from "./StoryComposition.schema.ts";
import { buildSceneWindows, computeKenBurnsTransform, computeSceneLayers } from "./StoryComposition.logic.ts";

export const StoryComposition: React.FC<StoryTemplateProps> = (props) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const windows = buildSceneWindows(props, fps);
  const layers = computeSceneLayers(windows, frame, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a" }}>
      {layers.map((layer) => (
        <SceneLayerView
          key={layer.sceneId}
          layer={layer}
        />
      ))}
    </AbsoluteFill>
  );
};

const SceneLayerView: React.FC<{
  layer: {
    assetPath: string;
    subtitle: string;
    subtitlePosition: "bottom" | "top" | "center";
    opacity: number;
    translateX: number;
    translateY: number;
    progressInScene: number;
    kenBurns?: {
      startScale: number;
      endScale: number;
      panDirection: "left" | "right" | "up" | "down" | "center";
    };
  };
}> = ({ layer }) => {
  const { width, height } = useVideoConfig();
  const subtitleContainerStyle = subtitlePositionToContainerStyle(layer.subtitlePosition);
  const subtitleBackgroundStyle = subtitlePositionToBackgroundStyle(layer.subtitlePosition);

  const kenBurns = layer.kenBurns
    ? computeKenBurnsTransform(layer.kenBurns, layer.progressInScene, { width, height })
    : null;

  return (
    <AbsoluteFill
      style={{
        opacity: layer.opacity,
        transform: `translate(${layer.translateX}px, ${layer.translateY}px)`,
      }}
    >
      <Img
        src={toRenderableAssetSrc(layer.assetPath)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: kenBurns
            ? `translate(${kenBurns.translateX}px, ${kenBurns.translateY}px) scale(${kenBurns.scale})`
            : undefined,
        }}
      />
      <AbsoluteFill
        style={{
          ...subtitleContainerStyle,
          padding: "0 60px 120px",
          ...subtitleBackgroundStyle,
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
          {layer.subtitle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const toRenderableAssetSrc = (value: string): string => {
  if (/^https?:\/\//.test(value) || value.startsWith("data:")) {
    return value;
  }
  return staticFile(value.replace(/^\/+/, ""));
};

const subtitlePositionToContainerStyle = (
  position: "bottom" | "top" | "center",
): React.CSSProperties => {
  if (position === "top") {
    return { justifyContent: "flex-start", paddingTop: 120 };
  }
  if (position === "center") {
    return { justifyContent: "center" };
  }
  return { justifyContent: "flex-end" };
};

const subtitlePositionToBackgroundStyle = (
  position: "bottom" | "top" | "center",
): React.CSSProperties => {
  if (position === "top") {
    return {
      background:
        "linear-gradient(0deg, rgba(15,23,42,0) 50%, rgba(15,23,42,0.82) 100%)",
    };
  }
  if (position === "center") {
    return {
      background: "rgba(15,23,42,0.35)",
    };
  }
  return {
    background:
      "linear-gradient(180deg, rgba(15,23,42,0) 50%, rgba(15,23,42,0.82) 100%)",
  };
};
