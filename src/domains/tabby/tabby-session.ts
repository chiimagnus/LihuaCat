import fs from "node:fs/promises";

import type { TabbyAgentClient } from "./tabby-agent.client.ts";
import type { TabbyOption, TabbyTurnOutput } from "../../contracts/tabby-turn.types.ts";
import type { TabbyConversationEvent } from "../../contracts/tabby-conversation.types.ts";

export type TabbySessionTui = {
  chooseOption: (input: {
    say: string;
    options: TabbyOption[];
    done: boolean;
    reviseDisabled: boolean;
  }) => Promise<TabbyOption>;
  askFreeInput: (input: { message: string }) => Promise<string>;
  onTurnStart?: (input: {
    turn: number;
    phase: "start" | "chat" | "revise";
  }) => Promise<void> | void;
  onTurnDone?: (input: {
    turn: number;
    phase: "start" | "chat" | "revise";
    output: TabbyTurnOutput;
  }) => Promise<void> | void;
};

export type RunTabbySessionInput = {
  photos: Array<{ photoRef: string; path: string }>;
  client: TabbyAgentClient;
  tui: TabbySessionTui;
  conversationLogPath?: string;
  maxReviseRounds?: number;
  now?: () => Date;
};

export type RunTabbySessionResult = {
  conversation: TabbyConversationEvent[];
  confirmedSummary: string;
};

export const runTabbySession = async ({
  photos,
  client,
  tui,
  conversationLogPath,
  maxReviseRounds = 3,
  now = () => new Date(),
}: RunTabbySessionInput): Promise<RunTabbySessionResult> => {
  const conversation: TabbyConversationEvent[] = [];
  let phase: "start" | "chat" | "revise" = "start";
  let turn = 1;
  let reviseRounds = 0;

  while (true) {
    await tui.onTurnStart?.({ turn, phase });
    const output = await client.generateTurn({
      photos,
      conversation,
      phase,
      turn,
    });
    await tui.onTurnDone?.({ turn, phase, output });

    await appendEvent(conversation, conversationLogPath, {
      type: "tabby",
      time: now().toISOString(),
      output,
    });

    const reviseDisabled = output.done && reviseRounds >= maxReviseRounds;
    const selectableOptions = reviseDisabled
      ? output.options.filter((option) => option.id !== "revise")
      : output.options;

    const selected = await tui.chooseOption({
      say: output.say,
      options: selectableOptions,
      done: output.done,
      reviseDisabled,
    });

    if (output.done) {
      await appendEvent(conversation, conversationLogPath, {
        type: "user",
        time: now().toISOString(),
        input: { kind: "option", id: selected.id, label: selected.label },
      });

      if (selected.id === "confirm") {
        return { conversation, confirmedSummary: output.say };
      }

      if (selected.id === "revise") {
        reviseRounds += 1;
        phase = "revise";
        turn += 1;
        continue;
      }

      throw new Error(`Unexpected selection in confirm page: ${selected.id}`);
    }

    if (selected.id === "free_input") {
      const text = await tui.askFreeInput({ message: "你想自己怎么说？" });
      await appendEvent(conversation, conversationLogPath, {
        type: "user",
        time: now().toISOString(),
        input: { kind: "free_input", text },
      });
    } else {
      await appendEvent(conversation, conversationLogPath, {
        type: "user",
        time: now().toISOString(),
        input: { kind: "option", id: selected.id, label: selected.label },
      });
    }

    phase = "chat";
    turn += 1;
  }
};

const appendEvent = async (
  conversation: TabbyConversationEvent[],
  logPath: string | undefined,
  event: TabbyConversationEvent,
) => {
  conversation.push(event);
  if (!logPath) return;
  await fs.appendFile(logPath, `${JSON.stringify(event)}\n`, "utf8");
};
