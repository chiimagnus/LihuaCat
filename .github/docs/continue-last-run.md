# Continue 上次对话/上次运行（需求整理）

## 背景

用户希望在以下场景中可以“继续”而不是从头开始：

- 用户中途退出（例如 Tabby 对话未完成）
- 运行报错退出（例如 Lynx 审稿失败、渲染失败）
- 需要在同一次 run 中接着跑后续阶段（不更换 `runId` / `outputDir`）

当前 CLI 入口通常通过 `pnpm run start` 启动（本质仍是运行 `src/index.ts` 的同一程序）。

---

## Goal（目标）

- 提供一个“继续上次运行”的能力：在交互式 TUI 中选择历史 run，并根据现有产物动态判断用户停留阶段，从对应阶段继续执行。
- “继续”默认沿用同一个 `outputDir`（同一 `runId` 目录继续写产物）。
- 继续逻辑可以在不同失败点恢复：Tabby 对话、StoryBrief 生成、脚本+Lynx 审稿循环、渲染、发布。

---

## Non-goals（非目标）

- 不实现“用户参与的改稿循环”（用户只在 Tabby 对话阶段参与）
- 不引入新的渲染模式
- 不做跨机器同步、云端存档、账号级历史（仅本地文件系统）
- 首版不要求提供复杂的“回滚/版本树”（先能继续跑通）

---

## 触发入口（已确定）

采用参数方式（同一命令加参数），例如：

- `pnpm run start -- --continue`
- （如果用户指定 input）`pnpm run start -- --input <DIR> --continue`

不新增子命令。

---

## 选择 run（已确定）

进入 TUI 让用户从历史 run 列表中选择一个继续（方案 B）。

数据来源（建议）：
- 扫描 `<inputDir>/lihuacat-output/*` 下的 run 目录
- 列表展示 runId + createdAt（可从 `stages/run-context.json` 或目录名解析）

---

## “继续”的目录策略（已确定）

沿用同一个 run 目录（方案 A）：

- 继续时使用用户选择的 `outputDir`（即 `<inputDir>/lihuacat-output/<runId>`）
- 后续阶段产物写入仍在此目录内

---

## 动态检测阶段（已确定）

系统根据 run 目录内已存在的产物，判断“当前停留阶段”，并从该阶段继续。

### 建议的阶段与判定信号（草案）

从后往前判断（优先继续最靠后的可继续阶段）：

1) Publish（发布完成）
- 信号：存在 `run.log` 且存在 `video.mp4` 且（可选）存在 publish-stage 产物
- 继续行为：提示“已完成”；可提供“重新渲染/重新发布”选项（可后续再做）

2) Render（可渲染但未成功/未执行）
- 信号：存在 `render-script.json`，但 `video.mp4` 不存在，或存在 `error.log`/`render-attempts.jsonl` 最后一次失败
- 继续行为：从渲染阶段开始（使用现有 `render-script.json`）

3) Script（脚本+Lynx 审稿循环）
- 信号：存在 `story-brief.json` 但 `render-script.json` 不存在；或存在部分 `lynx-review-*.json` / `ocelot-revision-*.json` 但未写出最终 `render-script.json`
- 继续行为：从脚本+审稿循环开始

4) StoryBrief
- 信号：存在 `tabby-conversation.jsonl`，但 `story-brief.json` 不存在
- 继续行为：从 story-brief 生成开始（基于历史对话与 confirmedSummary）

5) Tabby Session（继续对话）
- 信号：存在 `tabby-conversation.jsonl`，但对话未结束在 confirm（需要能判定最后事件/最后 tabby turn 的 `done` 状态）
- 继续行为：恢复 Tabby 对话循环，继续到 confirm/revise

> 注：Tabby “是否已结束”可能需要额外落盘一个 `tabby-stage.json`（已存在）或在 conversation 末尾增加结束标记，以便可靠判断。

---

## 继续时是否重跑（待确认）

用户问过“什么情况下会重跑？”——总结如下：

会重跑的原因通常只有两类：

1) 上次没跑完（中途退出/崩溃/报错）
- 缺产物或错误日志显示失败 → 从该阶段重跑

2) 产物不可用/被作废（校验失败/不一致/上游改动）
- JSON 损坏、schema/semantic 校验失败 → 从该阶段重跑
- 如果用户继续 Tabby 阶段并选择 `revise`，则下游（story-brief/script/render）应视为作废并重跑

---

## 冲突策略：同名产物已存在时怎么办（待确认）

继续时可能出现同名文件已存在（例如 `render-script.json`、`video.mp4`、`lynx-review-1.json`）。

候选策略：

- A) 直接覆盖（简单但丢历史）
- B) retry 命名（例如 `video.retry-2.mp4` / `render-script.retry-2.json`）
- C) retry 子目录（例如 `retries/2/...`）

---

## 交互策略：自动继续还是确认一步（待确认）

动态检测后：

- 方案 1：直接从推荐阶段继续
- 方案 2：展示“检测结果 + 推荐从哪一步继续”，允许用户手动改选

---

## 错误处理与门槛约束

- 继续命令仍要求 TTY（与现有 TUI 约束一致）
- Lynx 审稿失败（非 JSON/schema 不合法/运行异常）仍视为 workflow 失败（不应跳过审稿）
- 如果 run 目录结构不完整或不可读，应给出可读错误（例如“找不到 run-context.json/无法读取 outputDir”）

---

## 产物与可追溯性

继续功能本身不新增“业务产物”，但会影响产物落盘策略（尤其是冲突策略）。

现有/相关产物：
- `tabby-conversation.jsonl`
- `story-brief.json`
- `render-script.json`
- `ocelot-revision-{N}.json`
- `lynx-review-{N}.json`
- `lynx-prompt-{N}.log`
- `video.mp4`
- `run.log` / `error.log`
- `stages/*`（含 `run-context.json`、`progress-events.jsonl` 等）

---

## 实现落点（未来实现建议）

### 入口与参数解析
- 在 `src/commands/render-story.command.ts` 新增 `--continue` 参数
- 若 `--continue`：
  - 要求 `--input` 或通过 TUI 询问 inputDir
  - 扫描 `lihuacat-output`，展示 run 列表让用户选择

### Workflow 继续能力
现状 `runStoryWorkflowV2` 总是创建新 `runId/outputDir`。继续需要新增能力之一：

- 新增 `runStoryWorkflowContinue({ sourceDir, outputDir, ... })` 或
- 改造 `runStoryWorkflowV2` 支持可选 `resume: { outputDir }`

并提供：
- 基于 `outputDir` 初始化 runtime（不生成新 runId）
- 阶段检测与跳过逻辑（按上面的“判定信号”）

### 测试策略（未来实现建议）
- 新增 e2e 覆盖：
  - 从渲染失败继续（不重跑前置阶段）
  - 从 Lynx 审稿失败继续（仍要求 Lynx）
  - 从 Tabby 中途退出继续对话

