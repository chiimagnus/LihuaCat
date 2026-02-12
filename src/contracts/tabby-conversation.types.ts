import type { TabbyTurnOutput } from "./tabby-turn.types.ts";

export type TabbyUserInput =
  | { kind: "option"; id: string; label: string }
  | { kind: "free_input"; text: string };

export type TabbyConversationEvent =
  | { type: "tabby"; time: string; output: TabbyTurnOutput }
  | { type: "user"; time: string; input: TabbyUserInput };
