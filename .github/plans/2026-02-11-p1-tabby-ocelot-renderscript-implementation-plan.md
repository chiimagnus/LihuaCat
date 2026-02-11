# P1（Tabby → StoryBrief → Ocelot → RenderScript → Remotion）实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。

**Goal（目标）:** 端到端跑通「选目录 → 素材校验 → Tabby 看图对话（结构化回合输出 + 确认页）→ story-brief.json → Ocelot 产出 render-script.json（场景化）→ Remotion 渲染 video.mp4 落盘」闭环。

**Non-goals（非目标）:**
- 不做 Lynx 审稿与多轮脚本修改循环（留给 P2）
- 不做字段级表单编辑（修改通过回到对话继续聊）
- 不保留任何旧的 `story-script` 数据结构与生成链路
- 不保留 `ai_code` 与渲染模式选择（能力 D），渲染失败即报错退出

**Approach（方案）:**
- 保留能力 A（目录选择 + 素材校验）与 Remotion 模板的现有“图片铺满/字幕渐变底”组件；在模板内新增“转场动画 + Ken Burns”实现。
- 用 **两份新合同**替换中间层：`StoryBrief`（叙事资产）与 `RenderScript`（场景化渲染指令）。
- Tabby 通过多轮对话产出 `StoryBrief`：每轮输出强制为结构化 JSON（outputSchema），TUI 用 `select` 展示 2–4 个建议选项，且必须包含 `free_input`。
- Ocelot 读取 `StoryBrief` 产出 `RenderScript`，渲染器只消费 `RenderScript`（确定性映射）。
- 全量删除旧 `story-script`、旧 prompts、旧渲染模式选择循环、旧 ai_code 渲染链路；同步更新 README、business-logic 与测试基线。

**Acceptance（验收）:**
- `pnpm test` 全绿，`pnpm run build` 通过
- 运行一次交互流程后，产物目录 `<inputDir>/lihuacat-output/<runId>/` 至少包含：`video.mp4`、`story-brief.json`、`render-script.json`、`tabby-conversation.jsonl`、`run.log`（失败时包含 `error.log`）
- 产物目录包含 Ocelot 调试文件：`ocelot-input.json`、`ocelot-output.json`、`ocelot-prompt.log`
- Tabby 每轮输出满足约束：`options.length` ∈ [2,4] 且包含 `free_input`；`done=true` 时固定为 `confirm/revise`
- `render-script.json` 语义校验通过：所有 scene 的 duration 合法、总时长匹配、photoRef 可解析、transition/kenBurns 字段合法

---

## Plan A（主方案）

### P1：合同与校验（先定地基）

### Task 1: 新增 `StoryBrief` 合同与 schema 校验

**Files:**
- Create: `src/contracts/story-brief.types.ts`
- Create: `src/contracts/story-brief.schema.json`（如需要）
- Create: `src/domains/story-brief/validate-story-brief.ts`
- Test: `tests/validate-story-brief.spec.ts`

**Step 1: 实现**
- 定义 `StoryBrief` / `CreativeIntent` / `PhotoNote` / `NarrativeStructure` 的 TypeScript 类型（strict、最小但够用）
- 增加结构校验（至少：必填字段、photos 数量必须等于输入图片数、`emotionalWeight` ∈ [0,1]）

**Step 2: 验证**
- Run: `pnpm test -- tests/validate-story-brief.spec.ts`
- Expected: PASS

### Task 2: 新增场景化 `RenderScript` 合同与语义校验

**Files:**
- Create: `src/contracts/render-script.types.ts`
- Create: `src/contracts/render-script.schema.json`（如需要）
- Create: `src/domains/render-script/validate-render-script.ts`
- Test: `tests/validate-render-script.spec.ts`

**Step 1: 实现**
- 定义 `RenderScript`（顶层建议包含 `video {width,height,fps}` 与 `scenes[]`），并在 P1 固定为 `1080x1920 @ 30fps`（不由 Ocelot 决定）
- `RenderScene` 至少包含：`sceneId`、`photoRef`、`subtitle`、`subtitlePosition`、`durationSec`、`transition {type,durationMs}`、`kenBurns?`
- 语义校验建议包含：
  - `scenes.length >= 1`、`durationSec > 0`
  - `sum(durationSec)` 与最终视频总时长一致（或由 scenes 推导总时长并写回）
  - 每张图片至少使用一次（用户输入集合不可被跳过）
  - `slide` 方向可配置，但 P1 的生成约束只允许 `left/right`

**Step 2: 验证**
- Run: `pnpm test -- tests/validate-render-script.spec.ts`
- Expected: PASS

---

### P1：Tabby（对话）→ StoryBrief（叙事资产）

### Task 3: 定义 Tabby 回合输出合同（outputSchema + 本地校验）

**Files:**
- Create: `src/contracts/tabby-turn.types.ts`
- Create: `src/domains/tabby/validate-tabby-turn.ts`
- Test: `tests/validate-tabby-turn.spec.ts`

**Step 1: 实现**
- 定义 `TabbyTurnOutput = { say: string; options: {id,label}[]; done: boolean; internalNotes?: string }`
- 校验规则：
  - `options.length` ∈ [2,4]
  - `done=false` 时必须包含 `free_input`
  - `done=true` 时 `options` 必须固定为以下两项（且不允许 `free_input`）：
    - `{ id: "confirm", label: "就是这个感觉" }`
    - `{ id: "revise", label: "需要修改" }`

**Step 2: 验证**
- Run: `pnpm test -- tests/validate-tabby-turn.spec.ts`
- Expected: PASS

### Task 4: 实现 Tabby agent client（多轮回合输出，强制 JSON）

**Files:**
- Create: `src/domains/tabby/tabby-agent.client.ts`
- Create: `src/prompts/tabby-turn.prompt.ts`
- Modify: `src/prompts/index.ts`
- Test: `tests/tabby-agent.client.spec.ts`

**Step 1: 实现**
- 复用 `@openai/codex-sdk` 的 thread 模式，类似现有 `story-agent.client.ts`
- 每轮调用返回 `TabbyTurnOutput`（outputSchema 强约束），失败直接抛 `TabbyAgentResponseParseError`
- Prompt 输入包含：已收集的对话历史（结构化）、图片列表（local_image）、已知约束（options 规则、done 规则）

**Step 2: 验证**
- Run: `pnpm test -- tests/tabby-agent.client.spec.ts`
- Expected: PASS（用 mock codexFactory 断言 outputSchema 与解析行为）

### Task 5: 实现 Tabby session（TUI：select + free_input + confirm/revise）

**Files:**
- Create: `src/domains/tabby/tabby-session.ts`
- Modify: `src/commands/tui/render-story.tui.ts`（或拆新文件 `src/commands/tui/tabby.tui.ts`）
- Test: `tests/tabby-session.spec.ts`

**Step 1: 实现**
- 状态机：
  - `chat`：循环（Tabby 回合 → TUI select；选 `free_input` 则 text 输入）
  - `confirm`：Tabby `done=true` → select `confirm/revise`
  - `revise`：回到 `chat` 继续对话（写死上限 `maxReviseRounds = 3`，避免无限循环）
- 日志：每轮追加写入 `tabby-conversation.jsonl`（包含 userInput、tabbyOutput、timestamp；落盘 `internalNotes`）

**Step 2: 验证**
- Run: `pnpm test -- tests/tabby-session.spec.ts`
- Expected: PASS（用 mock TabbyAgentClient 断言 select 分支与日志写入）

### Task 6: Tabby 最终产出 StoryBrief（确认后落盘）

**Files:**
- Create: `src/domains/story-brief/generate-story-brief.ts`
- Create: `src/prompts/story-brief.prompt.ts`
- Modify: `src/prompts/index.ts`
- Test: `tests/generate-story-brief.spec.ts`

**Step 1: 实现**
- `generateStoryBrief({ images, conversation }) -> StoryBrief` 使用 outputSchema 强约束
- 强制把用户在确认页“确认通过”的摘要与原始对话一起作为输入（避免只依赖最后一轮输出）

**Step 2: 验证**
- Run: `pnpm test -- tests/generate-story-brief.spec.ts`
- Expected: PASS（mock client，校验结构校验失败时可定位）

---

### P1：Ocelot（编剧）→ RenderScript（渲染指令）

### Task 7: 实现 Ocelot agent client（StoryBrief → RenderScript）

**Files:**
- Create: `src/domains/render-script/ocelot-agent.client.ts`
- Create: `src/prompts/render-script.prompt.ts`
- Modify: `src/prompts/index.ts`
- Test: `tests/ocelot-agent.client.spec.ts`

**Step 1: 实现**
- 输入：`StoryBrief` + 图片列表（local_image）
- 输出：`RenderScript`（outputSchema 强约束）+ 本地语义校验（`validate-render-script`）
- 落盘调试文件（对照产品地基文档产物表）：
  - `ocelot-input.json`（传入的 StoryBrief）
  - `ocelot-output.json`（原始响应/最终 RenderScript）
  - `ocelot-prompt.log`（实际 prompt）

**Step 2: 验证**
- Run: `pnpm test -- tests/ocelot-agent.client.spec.ts`
- Expected: PASS

---

### P1：Workflow/CLI 编排（破坏性替换 B/C/D + 新产物落盘）

### Task 8: 新增 workflow stages：tabby、ocelot、render（单路径）

**Files:**
- Create: `src/workflow/stages/tabby.stage.ts`
- Create: `src/workflow/stages/ocelot.stage.ts`
- Modify: `src/workflow/start-story-run.ts`
- Modify: `src/workflow/workflow-ports.ts`
- Test: `tests/workflow-contract.spec.ts`

**Step 1: 实现**
- stages 顺序改为：collect-images → tabby → ocelot → render → publish
- 删除 `chooseRenderMode` / `onRenderFailure` / `RenderChoiceMachine` 相关依赖

**Step 2: 验证**
- Run: `pnpm test -- tests/workflow-contract.spec.ts`
- Expected: PASS（断言 stage events 顺序更新）

### Task 9: 重写/替换 CLI flow：去掉 askStyle/askPrompt/模式选择

**Files:**
- Modify: `src/flows/create-story-video/create-story-video.flow.ts`
- Modify: `src/commands/render-story.command.ts`
- Modify: `src/commands/tui/render-story.tui.ts`
- Test: `tests/create-story-video.flow.spec.ts`
- Test: `tests/render-story.command.spec.ts`

**Step 1: 实现**
- CLI 只保留：
  - `--input`
  - `--browser-executable`
  - `--model` / `--model-reasoning-effort`（同时用于 Tabby 与 Ocelot）
- TUI 改造：
  - `askSourceDir` 保留
  - 新增 Tabby 会话 UI（对话气泡 + select + free_input）
  - 取消“render mode 选择”

**Step 2: 验证**
- Run: `pnpm test -- tests/render-story.command.spec.ts`
- Expected: PASS（删除 `--mode`/`--mode-sequence` 相关断言并更新行为）

### Task 10: 重构 workflow runtime 产物：新增 StoryBrief/RenderScript 路径与 jsonl 追加写

**Files:**
- Modify: `src/workflow/workflow-runtime.ts`
- Modify: `src/workflow/stages/publish.stage.ts`
- Modify: `src/domains/artifact-publish/publish-artifacts.ts`
- Modify: `src/domains/artifact-publish/build-run-summary.ts`
- Test: `tests/publish-artifacts.spec.ts`

**Step 1: 实现**
- runtime 新增路径：
  - `storyBriefPath = <outputDir>/story-brief.json`
  - `renderScriptPath = <outputDir>/render-script.json`
  - `tabbyConversationPath = <outputDir>/tabby-conversation.jsonl`
- runtime 新增路径（Ocelot 调试）：
  - `ocelotInputPath = <outputDir>/ocelot-input.json`
  - `ocelotOutputPath = <outputDir>/ocelot-output.json`
  - `ocelotPromptLogPath = <outputDir>/ocelot-prompt.log`
- publish 产物 summary 改为输出上述路径，移除 `storyScriptPath`/`generatedCodePath`

**Step 2: 验证**
- Run: `pnpm test -- tests/publish-artifacts.spec.ts`
- Expected: PASS

---

### P1：Remotion 模板改造（消费 RenderScript scenes）

### Task 11: 模板 props 从 StoryScript 切换到 RenderScript

**Files:**
- Modify: `src/story-template/StoryComposition.schema.ts`
- Modify: `src/story-template/StoryComposition.tsx`
- Modify: `src/story-template/StoryComposition.logic.ts`
- Test: `tests/StoryComposition.spec.ts`

**Step 1: 实现**
- 把模板输入改为 `RenderScript`（或 `RenderScript` 的可渲染子集），驱动 scenes 渲染
- 保留现有“图片铺满 + 字幕渐变底”视觉

**Step 2: 验证**
- Run: `pnpm test -- tests/StoryComposition.spec.ts`
- Expected: PASS

### Task 12: 新增转场动画（fade/cut/dissolve/slide）

**Files:**
- Modify: `src/story-template/StoryComposition.tsx`
- Modify: `src/story-template/StoryComposition.logic.ts`
- Test（如需）: `tests/StoryComposition.transitions.spec.ts`

**Step 1: 实现**
- 基于相邻 scenes 的 transition 配置，在 scene 边界实现：
  - `cut`：硬切
  - `fade/dissolve`：前后画面 alpha 插值
  - `slide`：位移动画（方向先固定，后续再扩展）

**Step 2: 验证**
- Run: `pnpm test -- tests/StoryComposition.spec.ts`
- Expected: PASS（至少保证逻辑层生成的 frames 不出错）

### Task 13: 新增 Ken Burns（scale + panDirection）

**Files:**
- Modify: `src/story-template/StoryComposition.tsx`
- Modify: `src/story-template/StoryComposition.logic.ts`

**Step 1: 实现**
- 对每个 scene 的图片加 transform 动画（scale + translate），panDirection 支持：left/right/up/down/center

**Step 2: 验证**
- Run: `pnpm test -- tests/StoryComposition.spec.ts`
- Expected: PASS

### Task 14: 渲染 domain 改造：`render-by-template` 读取 RenderScript

**Files:**
- Modify: `src/domains/template-render/render-by-template.ts`
- Modify: `src/domains/render-assets/stage-remotion-assets.ts`
- Test: `tests/render-by-template.spec.ts`
- Test: `tests/stage-remotion-assets.spec.ts`

**Step 1: 实现**
- render adapter 的 inputProps 改为 RenderScript + staged assets 映射（photoRef → staticFile path）
- 语义校验从旧 story-script 校验切换到 `validate-render-script`

**Step 2: 验证**
- Run: `pnpm test -- tests/render-by-template.spec.ts`
- Expected: PASS

---

### P1：删除旧代码（破坏性重构落地）

### Task 15: 删除 story-script 相关 contracts/domains/prompts/tests

**Files:**
- Delete: `src/contracts/story-script.types.ts`
- Delete: `src/contracts/story-script.schema.json`
- Delete: `src/domains/story-script/*`
- Delete: `src/prompts/story-script.prompt.ts`
- Modify: `src/prompts/index.ts`
- Modify/Delete: 对应 `tests/*story-script*`、`tests/prompts.spec.ts` 等

**Step 1: 实现**
- 清理所有引用，确保 `pnpm run build` 无 TypeScript 残留报错

**Step 2: 验证**
- Run: `pnpm run build`
- Expected: build success

### Task 16: 删除 ai_code 渲染与渲染模式选择链路

**Files:**
- Delete: `src/domains/ai-code-render/*`
- Delete: `src/domains/render-choice/*`
- Modify: `src/workflow/stages/render.stage.ts`（改为单路径）
- Modify: `tests/*`（删除/更新 mode-sequence、ai_code 相关）

**Step 1: 实现**
- render stage 只调用 template 渲染一次；失败直接 throw 并写 `error.log`

**Step 2: 验证**
- Run: `pnpm test`
- Expected: PASS

---

### P1：对外文档与基线同步

### Task 17: 更新 README 与 business-logic

**Files:**
- Modify: `README.md`
- Modify: `README.zh.md`
- Modify: `.github/docs/business-logic.md`

**Step 1: 实现**
- 更新输入输出与参数（移除 `--mode`、`--mode-sequence`、`--style`、`--prompt`）
- 更新产物清单（`story-brief.json`、`render-script.json`、`tabby-conversation.jsonl`）
- 更新“能力 B/C/D”的描述为 Tabby/Ocelot 新链路

**Step 2: 验证**
- 人工校对：README 描述与 CLI 行为一致

---

## 批次回归建议

- 每完成一个大分组（合同 / Tabby / Ocelot / Workflow / Template / 删除旧代码）后跑：`pnpm test`
- 合并前最终跑：`pnpm test && pnpm run build`

## 已拍板（执行前写死，避免执行者猜）

- `RenderScript.video`：系统固定 `1080x1920 @ 30fps`，不由 Ocelot 决定
- 图片覆盖：`RenderScript` 要求“每张图片至少使用一次”，写入 `validate-render-script` 与 Ocelot prompt 的硬约束
- `slide` 方向：render-script 支持方向配置，但 P1 的 Ocelot 只生成 `left/right`
