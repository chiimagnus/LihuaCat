# 音乐生成 Agent + Ocelot 架构升级 实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。

**Goal（目标）:** 在保持现有 CLI 入口与主流程可用的前提下，完成 Ocelot 创意总监化（CreativePlan + 审稿循环）、Kitten/Cub sub-agent、MIDI 到 SoundFont 音频链路、Remotion 音频合并，并落地新的运行产物。

**Non-goals（非目标）:**
- 不做多 renderer（漫画/AVP/长图）插件化改造。
- 不做用户自定义音乐风格或配器高级参数。
- 不做云端部署、远程服务依赖或兼容旧 Lynx 流程的双轨方案。

**Approach（方案）:**
1. 先做合同与校验（Contract-First），把 CreativePlan / VisualScript / MIDI JSON 先固定下来。
2. 再分别落地 Cub（音乐）与 Kitten（视觉）两个可独立验证的 sub-agent。
3. 之后升级 Ocelot 为总导演，接管审稿循环与改稿指令分发，替换 Lynx。
4. 最后接入 MIDI->WAV（FluidSynth）与 Remotion 音频合成，统一发布产物并清理旧代码。
5. 每个优先级分组完成后执行全量回归：`pnpm test && pnpm run build`。

**Acceptance（验收）:**
- 运行流程可生成并保存：`creative-plan.json`、`visual-script.json`、`review-log.json`、`music.mid`、`music.wav`、`video.mp4`。
- Ocelot 可对 Kitten/Cub 输出进行最多 3 轮审稿和改稿，超限记录 warning 并继续渲染。
- Remotion 成片包含本地合成音频轨。
- 仓库中不再存在 Lynx 相关运行链路与无效测试。

---

## P1（最高优先级）：新增数据合同与校验底座

前置依赖：无  
可独立验证：合同类型、schema、validator 及单测可独立通过

### Task 1: 新增 CreativePlan 合同

**Files:**
- Create: `src/contracts/creative-plan.types.ts`
- Modify: `src/app/workflow/stages/tabby.stage.ts`
- Test: `tests/creative-plan.contract.spec.ts`

**Step 1: 实现功能**
- 定义 `CreativePlan`（视觉方向、叙事钉点、音乐意图、审稿约束）及解析/校验函数。
- 在 Tabby 阶段输出中预留 CreativePlan 上下游所需字段（先不改流程编排）。

**Step 2: 验证**
Run: `pnpm test -- tests/creative-plan.contract.spec.ts tests/validate-story-brief.spec.ts`  
Expected: 合同校验通过；不影响 StoryBrief 既有校验。

### Task 2: 新增 VisualScript 合同

**Files:**
- Create: `src/contracts/visual-script.types.ts`
- Modify: `src/contracts/render-script.types.ts`
- Test: `tests/visual-script.contract.spec.ts`

**Step 1: 实现功能**
- 定义 `VisualScript`（场景、转场、字幕、镜头参数）合同。
- 明确 `VisualScript -> RenderScript` 映射边界（先定义字段，不做完整编排）。

**Step 2: 验证**
Run: `pnpm test -- tests/visual-script.contract.spec.ts tests/validate-render-script.spec.ts`  
Expected: VisualScript 合同可被解析并与 RenderScript 兼容。

### Task 3: 新增 MIDI JSON 合同

**Files:**
- Create: `src/contracts/midi.types.ts`
- Modify: `src/tools/index.ts`
- Test: `tests/midi.contract.spec.ts`

**Step 1: 实现功能**
- 定义 MIDI JSON schema（BPM、4/4、固定四轨、note/tick/duration/velocity）。
- 暴露 MIDI 合同的 validator 给后续 Cub 与音频工具使用。

**Step 2: 验证**
Run: `pnpm test -- tests/midi.contract.spec.ts tests/agent-output-schema.spec.ts`  
Expected: 合同校验通过，非法 note/timing 可被拦截。

### Task 4: 合同层回归门

**Files:**
- Modify: `tests/workflow-contract.spec.ts`

**Step 1: 实现功能**
- 更新 workflow 合同测试，确保 CreativePlan / VisualScript / MIDI 合同在链路中可序列化。

**Step 2: 验证（P1 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 全量测试与构建通过。

---

## P2：Cub 音乐 sub-agent（prompt + outputSchema + MIDI 写入）

前置依赖：P1 MIDI 合同已完成  
可独立验证：不接入主流程也可生成合法 MIDI JSON 与 `.mid`

### Task 5: 搭建 Cub agent 骨架

**Files:**
- Create: `src/agents/cub/index.ts`
- Create: `src/agents/cub/cub.client.ts`
- Create: `src/agents/cub/cub.prompt.ts`
- Create: `src/agents/cub/cub.schema.ts`
- Create: `src/agents/cub/cub.validate.ts`
- Modify: `src/agents/index.ts`
- Test: `tests/cub-agent.client.spec.ts`

**Step 1: 实现功能**
- 按现有 agent 结构（client/prompt/schema/validate）实现 Cub。
- 输入为 CreativePlan 音乐意图，输出受 MIDI JSON schema 约束。

**Step 2: 验证**
Run: `pnpm test -- tests/cub-agent.client.spec.ts tests/agent-output-schema.spec.ts`  
Expected: Cub 输出可通过 schema 校验。

### Task 6: MIDI JSON -> .mid 确定性工具

**Files:**
- Create: `src/tools/audio/midi-json-to-mid.ts`
- Modify: `src/tools/index.ts`
- Test: `tests/midi-json-to-mid.spec.ts`

**Step 1: 实现功能**
- 实现纯确定性转换：读取 MIDI JSON，输出 `music.mid`。
- 遇到合同外字段或时序错误时直接失败并返回可读错误。

**Step 2: 验证**
Run: `pnpm test -- tests/midi-json-to-mid.spec.ts`  
Expected: 成功生成 `.mid`；异常输入可稳定报错。

### Task 7: Cub 局部集成（不改 Ocelot 主编排）

**Files:**
- Modify: `src/app/workflow/workflow-ports.ts`
- Modify: `src/app/workflow/stages/script.stage.ts`
- Test: `tests/start-story-run.spec.ts`

**Step 1: 实现功能**
- 在 ports 中注册 Cub 端口。
- 在 script 阶段增加可选 Cub 调用分支（先以 feature flag/固定开关接入，便于独立验证）。

**Step 2: 验证（P2 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: Cub 接入不破坏现有脚本阶段与主流程。

---

## P3：Kitten 视觉脚本 sub-agent（从现有 Ocelot 链路拆出）

前置依赖：P1 VisualScript 合同已完成  
可独立验证：Kitten 可从 CreativePlan + 图片生成 VisualScript

### Task 8: 搭建 Kitten agent 骨架

**Files:**
- Create: `src/agents/kitten/index.ts`
- Create: `src/agents/kitten/kitten.client.ts`
- Create: `src/agents/kitten/kitten.prompt.ts`
- Create: `src/agents/kitten/kitten.schema.ts`
- Create: `src/agents/kitten/kitten.validate.ts`
- Modify: `src/agents/index.ts`
- Test: `tests/kitten-agent.client.spec.ts`

**Step 1: 实现功能**
- 按既有 agent 模式实现 Kitten。
- 输出严格落在 `VisualScript` 合同。

**Step 2: 验证**
Run: `pnpm test -- tests/kitten-agent.client.spec.ts tests/visual-script.contract.spec.ts`  
Expected: Kitten 输出可稳定通过 VisualScript 校验。

### Task 9: 从 Ocelot 提取视觉脚本职责

**Files:**
- Modify: `src/agents/ocelot/ocelot.prompt.ts`
- Modify: `src/agents/ocelot/ocelot.client.ts`
- Modify: `src/app/workflow/workflow-ports.ts`
- Modify: `src/app/workflow/stages/script.stage.ts`
- Test: `tests/ocelot-agent.client.spec.ts`

**Step 1: 实现功能**
- 让 Ocelot 不再直接生成完整 RenderScript，而是生成 CreativePlan 并调度 Kitten。
- 先保留 RenderScript 组装入口，确保与现有渲染阶段兼容。

**Step 2: 验证**
Run: `pnpm test -- tests/ocelot-agent.client.spec.ts tests/start-story-run.spec.ts`  
Expected: Ocelot + Kitten 协作可走通，旧链路不被破坏。

### Task 10: Kitten 分组回归门

**Files:**
- Modify: `tests/revise-render-script-with-lynx.spec.ts`

**Step 1: 实现功能**
- 为“无 Lynx、含 Kitten”的阶段行为补充/调整断言。

**Step 2: 验证（P3 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 视觉拆分后全量回归通过。

---

## P4：Ocelot 升级为创意总监（CreativePlan + 审稿循环编排）

前置依赖：P2 + P3 完成  
可独立验证：在无音频合成的情况下，审稿循环可闭环

### Task 11: 重构审稿循环，移除 Lynx 依赖点

**Files:**
- Create: `src/app/workflow/revise-creative-assets-with-ocelot.ts`
- Modify: `src/app/workflow/stages/script.stage.ts`
- Modify: `src/app/workflow/start-story-run.ts`
- Modify: `src/app/workflow/workflow-events.ts`
- Test: `tests/revise-creative-assets-with-ocelot.spec.ts`

**Step 1: 实现功能**
- 新建 Ocelot 主导的审稿循环：Ocelot 生成 CreativePlan -> 下发 Kitten/Cub -> 审稿 -> 改稿，最多 3 轮。
- 保留轮次、指令、通过状态到结构化对象，供后续发布。

**Step 2: 验证**
Run: `pnpm test -- tests/revise-creative-assets-with-ocelot.spec.ts tests/start-story-run.spec.ts`  
Expected: 轮次上限与通过/超限逻辑正确。

### Task 12: 新增 review-log 合同与产物落盘

**Files:**
- Create: `src/contracts/review-log.types.ts`
- Modify: `src/app/workflow/stages/script.stage.ts`
- Modify: `src/tools/artifacts/publish-artifacts.ts`
- Modify: `src/tools/artifacts/run-summary.ts`
- Test: `tests/review-log.contract.spec.ts`

**Step 1: 实现功能**
- 定义 `review-log.json` 数据结构（轮次、审稿意见、改稿指令、最终状态）。
- 在 publish 链路输出该文件并在 summary 中可追踪。

**Step 2: 验证**
Run: `pnpm test -- tests/review-log.contract.spec.ts tests/publish-artifacts.spec.ts`  
Expected: review log 可稳定写入并可被读取。

### Task 13: Ocelot 分组回归门

**Files:**
- Modify: `tests/workflow-contract.spec.ts`

**Step 1: 实现功能**
- 更新 workflow 合同测试，覆盖 CreativePlan + 审稿循环 + 产物路径。

**Step 2: 验证（P4 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 新编排链路全量回归通过。

---

## P5：SoundFont 合成链路（FluidSynth）+ Remotion 音频合并

前置依赖：P2 已能生成 `.mid`，P4 可输出稳定脚本产物  
可独立验证：给定 `.mid` 可在本地产出 `.wav` 并被 Remotion 使用

### Task 14: 新增 FluidSynth 工具链

**Files:**
- Create: `src/tools/audio/midi-to-wav-fluidsynth.ts`
- Create: `src/tools/audio/audio-pipeline.ts`
- Modify: `src/tools/index.ts`
- Test: `tests/midi-to-wav-fluidsynth.spec.ts`

**Step 1: 实现功能**
- 封装 FluidSynth 命令执行与错误处理（binary 检测、soundfont 路径检测、退出码校验）。
- 输入 `music.mid`，输出 `music.wav`。

**Step 2: 验证**
Run: `pnpm test -- tests/midi-to-wav-fluidsynth.spec.ts`  
Expected: mock/真实环境下都能验证成功路径与失败路径。

### Task 15: 扩展 Remotion 输入并合成音频轨

**Files:**
- Modify: `src/templates/remotion/StoryComposition.schema.ts`
- Modify: `src/templates/remotion/StoryComposition.tsx`
- Modify: `src/templates/remotion/StoryRoot.tsx`
- Modify: `src/tools/render-assets/stage-remotion-assets.ts`
- Modify: `src/tools/render/render-by-template.ts`
- Test: `tests/render-by-template.spec.ts`
- Test: `tests/stage-remotion-assets.spec.ts`

**Step 1: 实现功能**
- 在 Remotion schema 增加音频引用字段。
- 模板中挂载音频轨并保证无音频场景可降级。
- 资源 staging 支持 `.wav`（以及保留 `.mid` 作为产物，不强制进模板）。

**Step 2: 验证**
Run: `pnpm test -- tests/render-by-template.spec.ts tests/stage-remotion-assets.spec.ts tests/remotion-renderer-tuning.spec.ts`  
Expected: 渲染参数与资源 staging 全部通过，模板支持音频输入。

### Task 16: 发布产物扩展

**Files:**
- Modify: `src/app/workflow/stages/render.stage.ts`
- Modify: `src/app/workflow/stages/publish.stage.ts`
- Modify: `src/tools/artifacts/publish-artifacts.ts`
- Modify: `src/tools/artifacts/run-summary.ts`
- Test: `tests/publish-artifacts.spec.ts`

**Step 1: 实现功能**
- 确保输出目录包含：`creative-plan.json`、`visual-script.json`、`review-log.json`、`music.mid`、`music.wav`、`video.mp4`。
- 在 summary 中补齐新增产物路径。

**Step 2: 验证（P5 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 音频+视频合成链路可通过全量回归。

---

## P6：删除 Lynx、清理旧代码、更新文档

前置依赖：P4 已完成 Ocelot 审稿循环替代  
可独立验证：仓库中无 Lynx 运行链路且文档与现状一致

### Task 17: 删除 Lynx 代码与引用

**Files:**
- Delete: `src/agents/lynx/index.ts`
- Delete: `src/agents/lynx/lynx.client.ts`
- Delete: `src/agents/lynx/lynx.prompt.ts`
- Delete: `src/agents/lynx/lynx.schema.ts`
- Delete: `src/agents/lynx/lynx.validate.ts`
- Modify: `src/agents/index.ts`
- Modify: `src/app/workflow/workflow-ports.ts`
- Modify: `src/app/workflow/revise-render-script-with-lynx.ts`（删除或替换为新实现）
- Delete: `src/contracts/lynx-review.types.ts`

**Step 1: 实现功能**
- 删除 Lynx agent 与合同，清理 workflow 端口和调用点。
- 删除 `--lynx-review` 相关分支与 dead code（以当前 CLI 参数定义为准）。

**Step 2: 验证**
Run: `pnpm test -- tests/start-story-run.spec.ts tests/workflow-contract.spec.ts`  
Expected: 无 Lynx 引用残留，流程可启动。

### Task 18: 删除旧测试并补新回归

**Files:**
- Delete: `tests/revise-render-script-with-lynx.spec.ts`
- Delete: `tests/lynx-review.validator.spec.ts`
- Create: `tests/ocelot-creative-director-loop.spec.ts`
- Modify: `tests/prompts-language.spec.ts`

**Step 1: 实现功能**
- 删除 Lynx 专属测试，新增 Ocelot 创意总监循环测试。
- 更新 prompt 语言与规则测试以匹配新角色分工（Ocelot/Kitten/Cub）。

**Step 2: 验证**
Run: `pnpm test -- tests/ocelot-creative-director-loop.spec.ts tests/prompts-language.spec.ts`  
Expected: 新测试可覆盖核心行为，旧行为无残留断言。

### Task 19: 更新文档与实施说明

**Files:**
- Modify: `.github/docs/LihuaCat未来.md`
- Modify: `.github/docs/business-logic.md`
- Modify: `README.md`

**Step 1: 实现功能**
- 同步新架构职责分工、产物清单、FluidSynth 环境要求、失败兜底策略。
- 明确“默认本地运行 + 无 Lynx + 纯音乐”的边界。

**Step 2: 验证（P6 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 文档与代码一致；全量回归通过。

---

## 统一执行规则

1. 每个 Task 完成后先做局部验证，再进入下一个 Task。
2. 每个 P 分组结束后必须执行：`pnpm test && pnpm run build`。
3. 若需提交，建议任务粒度原子提交：`<type>: taskN - <summary>`（Conventional Commits）。
4. 遇到破坏性调整按“完全重构”约束处理：新方案落地后删除旧代码/旧测试/无效注释。

## 不确定项（需在开工前确认）

1. FluidSynth 与 `FluidR3_GM.sf2` 的默认发现策略（环境变量、固定路径或 CLI 参数）。
2. `music.wav` 缺失时的策略：阻断流程还是降级为静音视频（建议阻断并给出明确错误）。
3. CreativePlan 中音乐意图字段的最小集合（建议先固定：tempo/mood/intensity/structure）。
4. 是否在 P2/P3 阶段引入 feature flag，还是直接切主链（建议先 feature flag，P4 切主链）。
