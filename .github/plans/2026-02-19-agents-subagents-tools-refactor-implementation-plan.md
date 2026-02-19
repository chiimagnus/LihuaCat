# Agents/Subagents/Tools 架构完全重构实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。

**Goal（目标）:** 将 `src/` 完全重构为以 `agents / subagents / tools` 为一等公民的目录结构；编排层只依赖门面；LLM 调用仅存在于 agents/subagents 且通过 `tools/llm` 统一执行；鉴权仅在 CLI 命令入口做一次；重构完成后删除旧目录（不留兼容层）。

**Non-goals（非目标）:**
- 不新增功能/不改变对用户可见的核心行为（除必要的 bugfix）
- 不保留旧结构的兼容导出层/过渡分支/双轨实现
- 不引入新测试框架（仍用现有 Node test runner）

**Approach（方案）:**
- 一次性迁移（大爆炸）：先建立新骨架与依赖方向，再逐模块迁移实现并更新 imports，最后删除旧目录。
- 将“重复的 LLM 调用样板”下沉到 `src/tools/llm/*`（高层封装），agents/subagents 仅保留 prompt/schema/业务校验/语义约束。
- `src/app/workflow/*` 只做编排，严格限制依赖：仅可 import `agents/subagents/tools/contracts`。

**Acceptance（验收）:**
- `pnpm test` 通过
- `pnpm run build` 通过
- `pnpm run start` 可启动（需要 TTY 的交互流程在真实终端可跑通）
- `src/domains/*`、`src/prompts/*`、`src/workflow/*` 旧目录被删除且无残留引用
- LLM 鉴权检查只发生在命令入口（例如 `src/commands/render-story.command.ts`）
- 编排层（`src/app/workflow/*`）无任何 `@openai/codex-sdk` / prompt / fs-debug 落盘等实现细节

---

## P1（最高优先级）：新骨架 + 依赖方向 + LLM Tool

### Task 1: 建立新目录骨架（空实现先落地）

**Files:**
- Create: `src/app/workflow/`
- Create: `src/agents/`
- Create: `src/subagents/`
- Create: `src/tools/`
- Create: `src/tools/llm/`
- Create（可选重命名模板层）: `src/templates/`（或保留 `src/story-template/`，但需要统一命名）

**Step 1: 实现功能**
- 新建目录与最小 index/README（若需要）以便迁移时有落点。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 仍可通过（此阶段尽量不改现有 imports）

### Task 2: 设计 `tools/llm` 的高层 API（只写接口与最小实现）

**Files:**
- Create: `src/tools/llm/llm.types.ts`
- Create: `src/tools/llm/codex-runner.ts`
- Create: `src/tools/llm/json.ts`
- Create: `src/tools/llm/retry.ts`（用于“带 previousErrors 回灌”的通用重试）
- Create: `src/tools/llm/debug-artifacts.ts`（统一写 prompt/input/output 的可选落盘）

**Step 1: 实现功能**
- 提供统一能力：
  - Thread 管理与缓存（按 `{model, reasoningEffort, workingDirectory}`）
  - `runWithSchema(promptInput, { outputSchema }) -> unknown`
  - JSON 解析（含 code fence 去除、截断错误）
  - 通用重试：把“失败原因列表”回灌到上层构建 prompt（由上层决定如何拼进 prompt）
  - 可选 debug 落盘：写 prompt 文本、输入快照、输出快照（不要求每个 agent 都用）
- 明确边界：不做业务校验（结构/语义验证仍在 agent 内）。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 3: 将鉴权检查上移到命令入口（一次性）

**Files:**
- Modify: `src/commands/render-story.command.ts`
- Modify（若需要集中入口）: `src/index.ts`

**Step 1: 实现功能**
- 在 command 入口最早处执行一次 `assertCodexCliAuthenticated()`（或等价入口），失败则友好提示并退出。
- 移除 agent client 内的重复鉴权（后续迁移各 agent 时同步删除）。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

---

## P2：迁移 LLM 单元（agents/subagents）到新结构

> 顺序建议：先 subagent（StoryBrief）→ Tabby → Ocelot → Lynx。每迁移一个就让旧引用完全切过去，避免双轨。

### Task 4: 迁移 StoryBrief subagent（prompt/schema/client/validator）

**Files:**
- Create: `src/subagents/story-brief/prompt.ts`（从 `src/prompts/story-brief.prompt.ts` 迁移）
- Create: `src/subagents/story-brief/schema.ts`（输出 schema）
- Create: `src/subagents/story-brief/client.ts`（使用 `src/tools/llm/*`）
- Create: `src/subagents/story-brief/generate.ts`（从 `src/domains/story-brief/generate-story-brief.ts` 迁移）
- Create: `src/subagents/story-brief/validate.ts`（从 `src/domains/story-brief/validate-story-brief.ts` 迁移）
- Modify: `src/workflow/stages/tabby.stage.ts`（后续会迁移到 `src/app/workflow/`；此处先让引用切到新 subagent）

**Step 1: 实现功能**
- `client.ts` 不再直接依赖 `@openai/codex-sdk`；统一走 `tools/llm`。
- 保持现有行为：previousErrors 回灌、照片 `local_image` 输入、结构校验与重试次数。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 5: 迁移 Tabby agent（prompt/schema/client/session/validator）

**Files:**
- Create: `src/agents/tabby/prompt.ts`（从 `src/prompts/tabby-turn.prompt.ts` 迁移）
- Create: `src/agents/tabby/schema.ts`
- Create: `src/agents/tabby/client.ts`（替代 `src/domains/tabby/tabby-agent.client.ts`）
- Create: `src/agents/tabby/session.ts`（从 `src/domains/tabby/tabby-session.ts` 迁移）
- Create: `src/agents/tabby/validate.ts`（从 `src/domains/tabby/validate-tabby-turn.ts` 迁移）
- Modify: `src/commands/tui/render-story.tui.ts`（如需要调整 Tabby session 的接口）

**Step 1: 实现功能**
- client 全部改走 `tools/llm`，移除内部鉴权。
- 保持 Tabby 输出结构与现有校验一致。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 6: 迁移 Ocelot agent（RenderScript 生成）

**Files:**
- Create: `src/agents/ocelot/prompt.ts`（从 `src/prompts/render-script.prompt.ts` 迁移）
- Create: `src/agents/ocelot/schema.ts`
- Create: `src/agents/ocelot/client.ts`（替代 `src/domains/render-script/ocelot-agent.client.ts`）
- Create: `src/agents/ocelot/validate.ts`（从 `src/domains/render-script/validate-render-script.ts` 迁移）

**Step 1: 实现功能**
- 把 debug 落盘（input/output/prompt log）统一迁移到 `tools/llm/debug-artifacts.ts` 或 `agents/ocelot/debug.ts`，避免 client 内散落 `fs.writeFile`。
- 保持现有“结构校验 + 语义校验（固定 video/时长/全图使用/slide 方向限制）”逻辑不变。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 7: 迁移 Lynx agent（审稿）

**Files:**
- Create: `src/agents/lynx/prompt.ts`（从 `src/prompts/lynx-review.prompt.ts` 迁移）
- Create: `src/agents/lynx/schema.ts`
- Create: `src/agents/lynx/client.ts`（替代 `src/domains/lynx/lynx-agent.client.ts`）
- Create: `src/agents/lynx/validate.ts`（从 `src/domains/lynx/validate-lynx-review.ts` 迁移）

**Step 1: 实现功能**
- debug prompt log 落盘改走统一工具（同上）。
- 保持现有审稿结构校验与错误语义。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

---

## P3：迁移确定性能力到 tools（material-intake / render / artifacts / music / assets / auth）

### Task 8: 迁移素材收集与校验到 `tools/material-intake`

**Files:**
- Move/Rewrite: `src/domains/material-intake/*` → `src/tools/material-intake/*`
- Modify: 所有引用方 imports（workflow/command）

**Step 1: 实现功能**
- 保持素材规则完全一致（仅第一层、格式限制、数量限制、遇到不支持格式直接报错）。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 9: 迁移渲染执行到 `tools/render` + 模板层归位

**Files:**
- Move/Rewrite: `src/domains/template-render/*` → `src/tools/render/*`
- Move（如重命名）: `src/story-template/*` → `src/templates/remotion/*`（或保留原名但统一引用）

**Step 1: 实现功能**
- tools/render 仅提供“输入脚本+素材 → 本地渲染产物”的确定性执行接口。
- 模板 React/Remotion 代码与渲染执行分离：模板留在 `templates/*`，执行器留在 `tools/render/*`。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 10: 迁移产物落盘/发布到 `tools/artifacts`

**Files:**
- Move/Rewrite: `src/domains/artifact-publish/*` → `src/tools/artifacts/*`
- Move/Rewrite: `src/workflow/workflow-runtime.ts`（更像 artifacts 工具）→ `src/tools/artifacts/runtime.ts`

**Step 1: 实现功能**
- 统一“输出目录创建、runId、写入 storyBrief/renderScript/日志”的工具接口。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 11: 迁移 background-music / render-assets 到 tools

**Files:**
- Move/Rewrite: `src/domains/background-music/*` → `src/tools/background-music/*`
- Move/Rewrite: `src/domains/render-assets/*` → `src/tools/render-assets/*`

**Step 1: 实现功能**
- 保持现有行为；若当前未被主流程使用，可先迁移为“薄封装 + 保持导出”。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 12: Codex auth 作为 tool（但鉴权调用点在 command）

**Files:**
- Move/Rewrite: `src/domains/codex-auth/*` → `src/tools/auth/*`
- Modify: `src/commands/render-story.command.ts`（调用 `tools/auth` 的单次检查）

**Step 1: 实现功能**
- 将鉴权能力归位为 tool，但只在 command 入口调用一次。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

---

## P4：将 workflow 完全迁移到 app/workflow，并强制依赖方向

### Task 13: 迁移 workflow 核心编排到 `src/app/workflow/*`

**Files:**
- Move/Rewrite: `src/workflow/*` → `src/app/workflow/*`
- Move/Rewrite: `src/flows/create-story-video/*` → `src/app/workflow/*`（或 `src/app/flows/*`，二选一但必须统一）

**Step 1: 实现功能**
- 编排层通过 ports 依赖注入 agents/subagents/tools（避免直接 import 实现细节）。
- 让编排层成为唯一“端到端入口”，command 只做 wiring。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

### Task 14: 更新 command/pipeline wiring 到新入口

**Files:**
- Modify: `src/commands/render-story.command.ts`
- Modify: `src/pipeline.ts`（如仍需要保留对外门面，变薄为 wiring）

**Step 1: 实现功能**
- command 只做：参数解析、TUI 适配、单次鉴权、创建 ports、调用 workflow。

**Step 2: 验证**
- Run: `pnpm test`
- Expected: 通过

---

## P5：删除旧目录与清理引用（破坏性收尾）

### Task 15: 删除旧目录并清理所有残留 imports

**Files:**
- Delete: `src/domains/`
- Delete: `src/prompts/`
- Delete: `src/workflow/`
- Delete（如已迁移）: `src/flows/`
- Delete（如已重命名）: `src/story-template/`

**Step 1: 实现功能**
- `rg` 全仓搜索旧路径引用并逐个修复。

**Step 2: 验证**
- Run: `pnpm test`
- Run: `pnpm run build`
- Expected: 全绿

### Task 16: 回归验证主流程（TTY 手动）

**Files:**
- None

**Step 1: 验证**
- Run（在真实 TTY 终端）: `pnpm run dev -- --input tests --mode template`
- Expected: 能进入交互流程；产物目录结构与关键落盘文件仍符合预期

---

## 不确定项（执行前需确认/执行中需留意）

- `src/flows/*` 与 `src/workflow/*` 的最终归属：建议统一到 `src/app/workflow/*`，避免“双入口”。
- 模板目录是否改名为 `src/templates/*`：改名会触发较多 import 路径变更，但可读性更好。
- `tools/llm` 的 debug artifacts 命名与落盘位置：需要与现有产物目录规范保持一致，避免破坏调试习惯。

