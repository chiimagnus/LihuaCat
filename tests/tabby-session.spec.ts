import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runTabbySession } from "../src/domains/tabby/tabby-session.ts";
import type { TabbyTurnOutput } from "../src/contracts/tabby-turn.types.ts";

test("tabby session logs conversation and ends on confirm", async () => {
  await withTempDir(async (dir) => {
    const logPath = path.join(dir, "tabby-conversation.jsonl");
    const photoPaths = [
      { photoRef: "1.jpg", path: path.join(dir, "1.jpg") },
      { photoRef: "2.jpg", path: path.join(dir, "2.jpg") },
    ];
    await fs.writeFile(photoPaths[0]!.path, "fake-image");
    await fs.writeFile(photoPaths[1]!.path, "fake-image");

    const outputs: TabbyTurnOutput[] = [
      {
        say: "看到这组照片，你最想留下的感觉是什么？",
        done: false,
        options: [
          { id: "warm", label: "温柔、克制" },
          { id: "relief", label: "一种释然" },
          { id: "free_input", label: "我想自己说…" },
        ],
        internalNotes: "Start with core emotion.",
      },
      {
        say: "我理解你想表达的是：一种释然，但仍然温柔克制。",
        done: true,
        options: [
          { id: "confirm", label: "就是这个感觉" },
          { id: "revise", label: "需要修改" },
        ],
      },
    ];

    let callIndex = 0;
    const result = await runTabbySession({
      photos: photoPaths,
      client: {
        async generateTurn() {
          const output = outputs[callIndex];
          callIndex += 1;
          if (!output) throw new Error("no more outputs");
          return output;
        },
      },
      tui: createMockTui({
        chooseQueue: ["free_input", "confirm"],
        freeInputText: "说不清，但很轻。",
      }),
      conversationLogPath: logPath,
      now: () => new Date("2026-02-12T00:00:00.000Z"),
    });

    assert.equal(result.confirmedSummary, outputs[1]!.say);
    const log = await fs.readFile(logPath, "utf8");
    const lines = log.trim().split("\n").filter(Boolean);
    assert.equal(lines.length, 4); // tabby, user, tabby, user
    assert.ok(lines[0]!.includes("\"type\":\"tabby\""));
    assert.ok(lines[1]!.includes("\"kind\":\"free_input\""));
    assert.ok(lines[0]!.includes("internalNotes"));
  });
});

test("tabby session revises and re-enters chat phase", async () => {
  const phases: string[] = [];
  const result = await runTabbySession({
    photos: [{ photoRef: "1.jpg", path: "/tmp/1.jpg" }],
    client: {
      async generateTurn({ phase }) {
        phases.push(phase);
        if (phase === "start") {
          return {
            say: "先说说第一感觉？",
            done: false,
            options: [
              { id: "a", label: "开心" },
              { id: "free_input", label: "我想自己说…" },
            ],
          };
        }
        if (phase === "chat") {
          return {
            say: "我理解你想表达的是：开心。",
            done: true,
            options: [
              { id: "confirm", label: "就是这个感觉" },
              { id: "revise", label: "需要修改" },
            ],
          };
        }
        return {
          say: "那你觉得更像哪一种？",
          done: false,
          options: [
            { id: "b", label: "释然" },
            { id: "free_input", label: "我想自己说…" },
          ],
        };
      },
    },
    tui: createMockTui({
      chooseQueue: ["a", "revise", "b", "confirm"],
      freeInputText: "",
    }),
    now: () => new Date("2026-02-12T00:00:00.000Z"),
  });

  assert.ok(result.confirmedSummary.length > 0);
  assert.deepEqual(phases, ["start", "chat", "revise", "chat"]);
});

const createMockTui = ({
  chooseQueue,
  freeInputText,
}: {
  chooseQueue: string[];
  freeInputText: string;
}) => {
  return {
    async chooseOption({ options }: { options: Array<{ id: string; label: string }> }) {
      const id = chooseQueue.shift();
      if (!id) {
        throw new Error("chooseQueue empty");
      }
      const selected = options.find((option) => option.id === id);
      if (!selected) {
        throw new Error(`option not found: ${id}`);
      }
      return selected;
    },
    async askFreeInput() {
      return freeInputText;
    },
  };
};

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lihuacat-tabby-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

