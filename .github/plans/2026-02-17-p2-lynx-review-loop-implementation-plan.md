# P2：🐈‍⬛ Lynx 审稿 + 修改循环（破坏性重构）实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。

**Goal（目标）:** 加入“质检门槛”：`Tabby → StoryBrief → Ocelot 写脚本 → Lynx 审稿 → 不通过则 Ocelot 重写 → …`，最多 3 轮；超过轮次则用最后一版定稿继续渲染。Lynx 调用失败（非 JSON / schema 不合法 / 鉴权 / 运行异常）视为**工作流失败**（不出片）。

**Non-goals（非目标）:**
- 不做用户参与的改稿循环（用户只在 Tabby 对话阶段参与）
- 不引入新的渲染模式/renderer（仍然走现有 template render）
- 不做“内容质量”的主观优化（只做“忠实于叙事意图/avoidance”的质量门槛与可追溯性）

**Approach（方案）:**
- 新增独立 `lynx` domain：Codex agent client + prompt + 输出 schema + 结构校验（强类型、可测）
- 将“审稿 + 改稿循环”抽成独立编排单元（stage / use-case），由 workflow 调用，Ocelot 只负责“按 brief + revisionNotes 产出脚本”
- 所有轮次中间产物落盘可追溯：`lynx-review-{N}.json`、`ocelot-revision-{N}.json`、`lynx-prompt-{N}.log`
- 破坏性重构：允许修改 workflow 输入/RunSummary 字段、事件契约与测试；新方案落地后同步删除旧结构与无效日志字段

**Acceptance（验收）:**
- ✅ Lynx 能识别脚本与用户 avoidance 的冲突（例：“不要岁月静好”但脚本用了）
- ✅ 修改循环能收敛（最大轮次内通过或定稿）
- ✅ 经过 Lynx 审稿的最终脚本质量明显优于未审稿版本（至少在“avoidance/语气一致性/叙事意图忠实度”维度）
- ✅ 所有审稿轮次的中间文件可追溯

---

## P1（最高优先级）：新增 Lynx domain（强类型 + 严格校验）

### Task 1: 定义 Lynx 审稿契约类型

**Files:**
- Create: `src/contracts/lynx-review.types.ts`

**Step 1: 实现功能**
- 定义 `LynxReview`、`LynxReviewIssue` 等类型（包含 `passed`、`issues[]`、`requiredChanges[]`、可选 `summary`）
- 约束字段可被严格校验（例如：空数组/空字符串边界）

**Step 2: 验证**
- Run: `pnpm run check`
- Expected: TypeScript 通过

**Step 3: 原子提交（建议）**
- Run: `git add src/contracts/lynx-review.types.ts`
- Run: `git commit -m "feat: task1 - add lynx review contract types"`

---

### Task 2: Lynx prompt 与 output schema（STRICT JSON）

**Files:**
- Create: `src/prompts/lynx-review.prompt.ts`

**Step 1: 实现功能**
- 实现 `buildLynxReviewPromptInput({ storyBrief, renderScript, round, maxRounds })`
- 设计 prompt：聚焦“忠实于叙事意图/avoidance/语气/受众/audienceNote”，要求输出**纯 JSON**
- 输出 schema：支持 `passed:boolean`、`issues[]`（含定位信息如 `sceneId`/`subtitle`/`evidence`）、`requiredChanges[]`（具体可执行、可转发给 Ocelot）

**Step 2: 验证**
- Run: `pnpm run check`
- Expected: TypeScript 通过

**Step 3: 原子提交（建议）**
- Run: `git add src/prompts/lynx-review.prompt.ts`
- Run: `git commit -m "feat: task2 - add lynx review prompt and schema"`

---

### Task 3: LynxAgentClient（Codex tool-call 线程式 client）

**Files:**
- Create: `src/domains/lynx/lynx-agent.client.ts`
- Modify: `src/pipeline.ts`（导出 client 与默认模型常量）

**Step 1: 实现功能**
- 参考 `src/domains/render-script/ocelot-agent.client.ts` 的模式实现 `createCodexLynxAgentClient`
- 支持 debug：写 `lynx-prompt-{N}.log`（每轮单独文件，便于对齐审稿结果）
- 失败策略：非 JSON / schema 不合法 → 抛 `LynxAgentResponseParseError`

**Step 2: 验证**
- Run: `pnpm run check`
- Expected: TypeScript 通过

**Step 3: 原子提交（建议）**
- Run: `git add src/domains/lynx/lynx-agent.client.ts src/pipeline.ts`
- Run: `git commit -m "feat: task3 - add lynx agent client"`

---

### Task 4: LynxReview 结构校验（runtime validator）

**Files:**
- Create: `src/domains/lynx/validate-lynx-review.ts`
- Test: `tests/lynx-review.validator.spec.ts`

**Step 1: 实现功能**
- 类似 `validate-render-script.ts`：实现 `validateLynxReviewStructure(input)`，输出 `{ valid, errors, review? }`
- 覆盖边界：空字符串、空数组、issues 定位字段缺失等

**Step 2: 验证**
- Run: `pnpm test tests/lynx-review.validator.spec.ts`
- Expected: PASS

**Step 3: 原子提交（建议）**
- Run: `git add src/domains/lynx/validate-lynx-review.ts tests/lynx-review.validator.spec.ts`
- Run: `git commit -m "test: task4 - add lynx review validator coverage"`

---

## P2：实现“审稿 + 改稿循环”编排单元（质量门槛一等公民）

### Task 5: 扩展 Ocelot：支持 revisionNotes（破坏性调整）

**Files:**
- Modify: `src/domains/render-script/ocelot-agent.client.ts`
- Modify: `src/prompts/render-script.prompt.ts`

**Step 1: 实现功能**
- 扩展 `GenerateRenderScriptRequest`：新增可选 `revisionNotes`（`string[]` 或结构化对象，推荐 `string[]`）
- prompt 增加规则：当 `revisionNotes` 存在时必须逐条修复；特别强调 `StoryBrief.intent.avoidance` 的禁用项

**Step 2: 验证**
- Run: `pnpm run check`
- Expected: TypeScript 通过

**Step 3: 原子提交（建议）**
- Run: `git add src/domains/render-script/ocelot-agent.client.ts src/prompts/render-script.prompt.ts`
- Run: `git commit -m "feat: task5 - support ocelot revisions via revision notes"`

---

### Task 6: 新增“脚本质量门槛”use-case：循环收敛控制

**Files:**
- Create: `src/domains/render-script/revise-render-script-with-lynx.ts`
- Test: `tests/revise-render-script-with-lynx.spec.ts`

**Step 1: 实现功能**
- 实现纯逻辑编排函数（可注入 `ocelotClient` / `lynxClient`）：
  - round=1 先产出初稿 → Lynx 审
  - 不通过则把 `requiredChanges` 原样转发成 `revisionNotes` 进入下一轮
  - `maxRounds=3`：超轮次则返回最后一版（即使不通过）
  - Lynx 调用失败：直接抛错（工作流失败）
- 返回结构包含：`finalScript`、`rounds`、`reviews[]`（用于落盘/日志）

- **补充（已落地）：Ocelot 自动重试（语义/结构校验失败）**
  - 背景：Ocelot 输出可能因结构/语义校验失败而被拒绝（例如总时长不为 30s、未使用全部 photoRefs）。
  - 策略：每个 round 内允许对 Ocelot 进行额外重试（默认每轮 2 次重试，即最多 3 次 attempt），把“校验失败原因”追加进 `revisionNotes`，要求 Ocelot 修复后再返回。
  - 失败形态：若该 round 的 attempts 全部失败，抛出 `RenderScriptGenerationFailedError(round, attempts, reasons)`，并由 workflow 写入 `error.log`。

**Step 2: 验证**
- Run: `pnpm test tests/revise-render-script-with-lynx.spec.ts`
- Expected: PASS（覆盖：首轮通过 / 二轮通过 / 三轮仍不通过但定稿 / Lynx 抛错导致失败）

**Step 3: 原子提交（建议）**
- Run: `git add src/domains/render-script/revise-render-script-with-lynx.ts tests/revise-render-script-with-lynx.spec.ts`
- Run: `git commit -m "feat: task6 - add lynx gated render script revision loop"`

---

### Task 14（追加，已落地）: Ocelot 校验失败自动重试

> 注：此 Task 不在最初计划中，属于执行过程中的补强（避免因偶发校验失败导致整体失败），已落地后补文档对齐。

**Files:**
- Modify: `src/domains/render-script/revise-render-script-with-lynx.ts`
- Modify: `src/prompts/render-script.prompt.ts`
- (可选) Modify: `src/domains/render-script/ocelot-agent.client.ts`
- Test: `tests/revise-render-script-with-lynx.spec.ts`

**Step 1: 实现功能**
- 为每个 round 增加 `maxOcelotRetriesPerRound`，并把“自动校验失败原因”写入 `revisionNotes` 进行重试

**Step 2: 验证**
- Run: `pnpm test tests/revise-render-script-with-lynx.spec.ts`
- Expected: PASS

**Step 3: 原子提交（建议）**
- Run: `git commit -m "fix: task14 - retry ocelot on semantic errors"`

## P3：接入 workflow（产物落盘 + 事件 + CLI wiring）并更新契约测试

### Task 7: 扩展 runtime artifacts：新增 Lynx 产物路径与轮次文件命名

**Files:**
- Modify: `src/workflow/workflow-runtime.ts`

**Step 1: 实现功能**
- 在 `WorkflowRuntimeArtifacts` 增加：
  - `getLynxPromptLogPath(round)`
  - 轮次路径生成器（例如 `getLynxReviewPath(round)`、`getOcelotRevisionPath(round)`）
- 确保写入位置在 `outputDir` 根目录（与现有 `ocelot-*.json` 同级），满足：
  - `lynx-review-{N}.json`
  - `ocelot-revision-{N}.json`
  - `lynx-prompt-{N}.log`

**Step 2: 验证**
- Run: `pnpm run check`
- Expected: TypeScript 通过

**Step 3: 原子提交（建议）**
- Run: `git add src/workflow/workflow-runtime.ts`
- Run: `git commit -m "feat: task7 - add runtime artifact paths for lynx review loop"`

---

### Task 8: 重构 stages：用“脚本质量门槛 stage”替换旧 ocelot.stage

**Files:**
- Create: `src/workflow/stages/script.stage.ts`
- Modify: `src/workflow/start-story-run.ts`
- Delete: `src/workflow/stages/ocelot.stage.ts`（确认无引用后删除）

**Step 1: 实现功能**
- `script.stage.ts` 负责：
  - 调用 `revise-render-script-with-lynx` use-case
  - 每轮落盘：
    - `ocelot-revision-{N}.json`（该轮 RenderScript）
    - `lynx-review-{N}.json`（该轮审稿结果）
  - 最终写 `render-script.json`（与现有 renderer contract 保持一致）
  - run.log 记录：`renderScriptGeneratedInAttempts=<N>`、`lynxReviewRounds=<N>`、`lynxFinalPassed=<true|false>`
- `start-story-run.ts`：替换 `runOcelotStage` 调用为新 stage

**Step 2: 验证**
- Run: `pnpm run check`
- Expected: TypeScript 通过

**Step 3: 原子提交（建议）**
- Run: `git add src/workflow/stages/script.stage.ts src/workflow/start-story-run.ts`
- Run: `git rm src/workflow/stages/ocelot.stage.ts`
- Run: `git commit -m "refactor: task8 - replace ocelot stage with lynx gated script stage"`

---

### Task 9: Workflow 事件与 TUI 适配（契约更新）

**Files:**
- Modify: `src/workflow/workflow-events.ts`
- Modify: `src/commands/tui/render-story.tui.ts`
- Test: `tests/workflow-contract.spec.ts`

**Step 1: 实现功能**
- 新增事件（示例）：
  - `script_start` / `script_done`
  - `lynx_start` / `lynx_done`（可选；如果保留最小事件集则至少要有 `script_*`）
- 更新 TUI：对新增事件使用现有 `_start/_done` spinner 规则渲染
- 更新 `tests/workflow-contract.spec.ts`：期望序列加入脚本阶段事件（破坏性更新契约）

**Step 2: 验证**
- Run: `pnpm test tests/workflow-contract.spec.ts`
- Expected: PASS

**Step 3: 原子提交（建议）**
- Run: `git add src/workflow/workflow-events.ts src/commands/tui/render-story.tui.ts tests/workflow-contract.spec.ts`
- Run: `git commit -m "test: task9 - update workflow contract for lynx gated script stage"`

---

### Task 10: 接入 pipeline/command/flow（新增 Lynx 依赖，破坏性更新对外 API）

**Files:**
- Modify: `src/pipeline.ts`
- Modify: `src/commands/render-story.command.ts`
- Modify: `src/flows/create-story-video/create-story-video.flow.ts`
- Test: `tests/create-story-video.flow.spec.ts`

**Step 1: 实现功能**
- 在 `RunStoryWorkflowV2Input` 增加 `lynxAgentClient`
- command 层创建 `createCodexLynxAgentClient` 并注入 workflow
- flow 与其测试同步更新（补齐 lynx stub）

**Step 2: 验证**
- Run: `pnpm test tests/create-story-video.flow.spec.ts`
- Expected: PASS

**Step 3: 原子提交（建议）**
- Run: `git add src/pipeline.ts src/commands/render-story.command.ts src/flows/create-story-video/create-story-video.flow.ts tests/create-story-video.flow.spec.ts`
- Run: `git commit -m "feat: task10 - wire lynx agent into workflow and CLI"`

---

### Task 11: 扩展 RunSummary / publish artifacts（暴露 Lynx 产物路径，便于调试）

**Files:**
- Modify: `src/domains/artifact-publish/build-run-summary.ts`
- Modify: `src/domains/artifact-publish/publish-artifacts.ts`
- Modify: `src/workflow/stages/publish.stage.ts`
- Modify: `src/commands/tui/render-story.tui.ts`

**Step 1: 实现功能**
- RunSummary 增加字段（建议）：
  - `lynxPromptLogDir` 或 `lynxPromptLogPaths`
  - `lynxReviewDir` 或 `lynxReviewPaths`（如选择暴露列表）
  - `ocelotRevisionDir` 或 `ocelotRevisionPaths`
- publish 阶段把新增字段写入 summary（破坏性变更允许）
- TUI complete 输出新增 artifact paths（方便复现与验收）

**Step 2: 验证**
- Run: `pnpm run check`
- Expected: TypeScript 通过

**Step 3: 原子提交（建议）**
- Run: `git add src/domains/artifact-publish/build-run-summary.ts src/domains/artifact-publish/publish-artifacts.ts src/workflow/stages/publish.stage.ts src/commands/tui/render-story.tui.ts`
- Run: `git commit -m "feat: task11 - expose lynx review artifacts in run summary"`

---

### Task 12: 更新 workflow e2e：覆盖“二轮通过/超轮次定稿/lynx失败终止”

**Files:**
- Modify: `tests/start-story-run.e2e.spec.ts`

**Step 1: 实现功能**
- 为 e2e 测试注入 `lynxAgentClient` stub：
  - case1：首轮不通过、二轮通过 → 断言 `ocelot-revision-1/2.json` 与 `lynx-review-1/2.json` 存在
  - case2：三轮仍不通过但定稿 → 断言存在 3 轮文件且工作流继续 render
  - case3：lynx 抛错 → 断言 workflow reject（并检查 `error.log` 有记录）

**Step 2: 验证**
- Run: `pnpm test tests/start-story-run.e2e.spec.ts`
- Expected: PASS

**Step 3: 原子提交（建议）**
- Run: `git add tests/start-story-run.e2e.spec.ts`
- Run: `git commit -m "test: task12 - add e2e coverage for lynx review loop"`

---

### Task 13: 全量回归（构建 + 测试）

**Files:**
- N/A

**Step 1: 验证**
- Run: `pnpm run check`
- Run: `pnpm test`
- Run: `pnpm run build`
- Expected: 全部通过

**Step 2:（可选）原子提交（建议）**
- Run: `git status`（应干净）

---

## 不确定项（在执行前应清零）
- Lynx review 输出是否需要 `severity`（blocker/warn）与“允许定稿但未通过”的区分？（当前按 `passed=false` 统一处理，超轮次定稿仍继续渲染）
