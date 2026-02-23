# 音乐生成 Agent + Ocelot 架构升级 实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。

**Goal（目标）:** 在保持当前 TUI 入口可用的前提下，完成 Ocelot 创意总监化（CreativePlan + 审稿循环）、Kitten/Cub sub-agent、MIDI -> SoundFont 音频链路、Remotion 音频合成，以及新增产物落盘。

**Non-goals（非目标）:**
- 不做云端音乐生成或任何服务端依赖。
- 不做歌词/人声能力（仅纯音乐）。
- 不做用户自定义音乐风格（首版由 Ocelot 决策）。
- 不做多 renderer 插件化改造（漫画/AVP/长图等留到后续）。

**Approach（方案）:**
1. 先落地合同（CreativePlan / VisualScript / MIDI JSON / ReviewLog）与校验，再做 agent。
2. Cub 与 Kitten 先做可独立验证的最小闭环（单测通过、无需先改主 workflow）。
3. 再升级 Ocelot 为创意总监并接管审稿循环，最后删除 Lynx。
4. 音频链路单独收口：MIDI 写入 -> FluidSynth 合成 -> Remotion 合成。
5. 每个优先级分组结束后执行 `pnpm test && pnpm run build` 作为硬门槛。

**Acceptance（验收）:**
- `lihuacat-output/<runId>/` 至少包含：`creative-plan.json`、`visual-script.json`、`review-log.json`、`music.mid`、`music.wav`、`video.mp4`。
- Ocelot 审稿-改稿循环最多 3 轮，超限记录 warning 并继续渲染。
- Cub 失败时允许降级为无配乐渲染并写日志；SoundFont 合成失败时报错退出并保留 `music.mid`。
- Remotion 成片可挂载音频轨，音视频总时长取两者最大值。
- 仓库内不再保留 Lynx 运行链路、参数入口与测试。

---

## 审查修订点（逐条）

1. 修正了与设计冲突的条目：不再要求在 P1 修改 `tabby.stage.ts` 生成 CreativePlan。
2. 修正 MIDI 字段定义：统一使用 `startMs/durationMs`，不再混用 tick 语义。
3. 补齐了主链路遗漏文件：`src/pipeline.ts`、`src/app/tui/render-story.command.ts`、`src/app/tui/render-story.tui.ts`。
4. 补齐了产物模型遗漏文件：`src/app/workflow/workflow-runtime.ts`、`src/tools/artifacts/run-summary.ts`。
5. 补齐了 Lynx 删除的联动测试：`tests/render-story.command.spec.ts`、`tests/start-story-run.e2e.spec.ts`、`tests/agent-output-schema.spec.ts` 等。
6. 删除“修改后再删除”的重复工作（例如过早改 `tests/revise-render-script-with-lynx.spec.ts`）。
7. 明确了 P2/P3 先独立验证、P4 再接入 workflow，减少返工。
8. 明确了音频失败策略：Cub 可降级无配乐；FluidSynth 失败直接中断。
9. 明确了 Remotion 时长策略：音视频取最大值，不做补偿。
10. 增加了依赖变更任务（`package.json` / `pnpm-lock.yaml`）。

---

## P1（最高优先级）：新增数据合同与校验

前置依赖：无  
可独立验证：纯合同层测试可通过

### Task 1: 新增 CreativePlan / VisualScript / MIDI / ReviewLog 合同

**Files:**
- Create: `src/contracts/creative-plan.types.ts`
- Create: `src/contracts/visual-script.types.ts`
- Create: `src/contracts/midi.types.ts`
- Create: `src/contracts/review-log.types.ts`

**Step 1: 实现功能**
- 定义四个核心合同及类型守卫/校验函数。
- MIDI 合同固定 4 轨（Piano/Strings/Bass/Drums）与 `4/4` 拍号。

**Step 2: 验证**
Run: `pnpm test -- tests/creative-plan.contract.spec.ts tests/visual-script.contract.spec.ts tests/midi.contract.spec.ts tests/review-log.contract.spec.ts`  
Expected: 合同层测试通过。

### Task 2: 更新 RenderScript 合同以承载音频引用

**Files:**
- Modify: `src/contracts/render-script.types.ts`
- Test: `tests/validate-render-script.spec.ts`

**Step 1: 实现功能**
- 为渲染脚本增加音频引用字段（例如 `audioTrack` 或等价字段）。
- 保持旧视觉字段结构不变，避免影响现有渲染语义。

**Step 2: 验证**
Run: `pnpm test -- tests/validate-render-script.spec.ts`  
Expected: 旧脚本仍可通过；新音频字段可被校验。

### Task 3: 合同与 schema 回归覆盖

**Files:**
- Modify: `tests/agent-output-schema.spec.ts`
- Modify: `tests/workflow-contract.spec.ts`

**Step 1: 实现功能**
- 新增 CreativePlan / VisualScript / MIDI schema 断言。
- 更新 workflow contract，确保新合同可序列化进入流程。

**Step 2: 验证（P1 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 全量测试与构建通过。

---

## P2：Cub 音乐 sub-agent（独立闭环）

前置依赖：P1 MIDI 合同完成  
可独立验证：无需接入主 workflow 即可生成合法 MIDI JSON 与 `.mid`

### Task 4: 实现 Cub agent（prompt/schema/client/validate）

**Files:**
- Create: `src/agents/cub/index.ts`
- Create: `src/agents/cub/cub.prompt.ts`
- Create: `src/agents/cub/cub.schema.ts`
- Create: `src/agents/cub/cub.validate.ts`
- Create: `src/agents/cub/cub.client.ts`
- Modify: `src/agents/index.ts`
- Test: `tests/cub-agent.client.spec.ts`
- Test: `tests/cub.validate.spec.ts`

**Step 1: 实现功能**
- 输入 CreativePlan 音乐意图，输出受 MIDI JSON schema 强约束的结构化结果。
- 支持 revisionNotes（供后续 Ocelot 改稿）。

**Step 2: 验证**
Run: `pnpm test -- tests/cub-agent.client.spec.ts tests/cub.validate.spec.ts`  
Expected: Cub 输出稳定满足 schema。

### Task 5: MIDI JSON -> .mid 确定性转换工具

**Files:**
- Create: `src/tools/audio/midi-json-to-mid.ts`
- Modify: `src/tools/index.ts`
- Test: `tests/midi-json-to-mid.spec.ts`

**Step 1: 实现功能**
- 将 MIDI JSON 确定性写入 `music.mid`。
- 结构非法或时序非法时直接失败。

**Step 2: 验证**
Run: `pnpm test -- tests/midi-json-to-mid.spec.ts tests/midi.contract.spec.ts`  
Expected: 合法输入输出 `.mid`，非法输入报错。

### Task 6: 依赖与导出补齐

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/pipeline.ts`

**Step 1: 实现功能**
- 引入 MIDI 写入所需依赖（择一：`midi-writer-js` 或 `@tonejs/midi`）。
- 暴露 Cub client 的类型与工厂导出。

**Step 2: 验证（P2 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 依赖安装后全量通过。

---

## P3：Kitten 视觉脚本 sub-agent（独立闭环）

前置依赖：P1 VisualScript 合同完成  
可独立验证：无需改主 workflow 即可产出 VisualScript

### Task 7: 实现 Kitten agent（prompt/schema/client/validate）

**Files:**
- Create: `src/agents/kitten/index.ts`
- Create: `src/agents/kitten/kitten.prompt.ts`
- Create: `src/agents/kitten/kitten.schema.ts`
- Create: `src/agents/kitten/kitten.validate.ts`
- Create: `src/agents/kitten/kitten.client.ts`
- Modify: `src/agents/index.ts`
- Test: `tests/kitten-agent.client.spec.ts`
- Test: `tests/kitten.validate.spec.ts`

**Step 1: 实现功能**
- 输入 CreativePlan 视觉方向 + 图片，输出 VisualScript。
- 支持 revisionNotes（供后续 Ocelot 改稿）。

**Step 2: 验证**
Run: `pnpm test -- tests/kitten-agent.client.spec.ts tests/kitten.validate.spec.ts tests/visual-script.contract.spec.ts`  
Expected: Kitten 输出可稳定通过合同校验。

### Task 8: 实现确定性合并工具（VisualScript + 音频引用 -> RenderScript）

**Files:**
- Create: `src/tools/render/merge-creative-assets.ts`
- Modify: `src/tools/render/render-by-template.ts`
- Modify: `src/tools/index.ts`
- Test: `tests/merge-creative-assets.spec.ts`

**Step 1: 实现功能**
- 将 VisualScript 与可选音频引用合并为 RenderScript。
- 合并逻辑完全确定性，不引入 LLM 判断。

**Step 2: 验证**
Run: `pnpm test -- tests/merge-creative-assets.spec.ts tests/render-by-template.spec.ts`  
Expected: 合并结果可被现有渲染入口接受。

### Task 9: Prompt 语言规则回归（新增 Kitten/Cub）

**Files:**
- Modify: `tests/prompts-language.spec.ts`

**Step 1: 实现功能**
- 将语言规则断言扩展到 Kitten/Cub prompt。

**Step 2: 验证（P3 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: Prompt 规则与全量回归通过。

---

## P4：Ocelot 升级为创意总监（编排 + 审稿循环）

前置依赖：P2 + P3 完成  
可独立验证：在无 SoundFont 情况下可完成 CreativePlan/审稿闭环

### Task 10: 升级 Ocelot 客户端职责（CreativePlan + 审稿指令）

**Files:**
- Modify: `src/agents/ocelot/ocelot.client.ts`
- Modify: `src/agents/ocelot/ocelot.prompt.ts`
- Modify: `src/agents/ocelot/ocelot.schema.ts`
- Modify: `src/agents/ocelot/ocelot.validate.ts`
- Test: `tests/ocelot-agent.client.spec.ts`

**Step 1: 实现功能**
- 从“直接产出 RenderScript”升级为：生成 CreativePlan + 产出审稿意见/改稿指令。
- 保留必要兼容辅助，直到 P6 完成清理。

**Step 2: 验证**
Run: `pnpm test -- tests/ocelot-agent.client.spec.ts tests/agent-output-schema.spec.ts`  
Expected: Ocelot 新输出结构可被验证。

### Task 11: 新增 Ocelot 主导审稿循环（替代 Lynx 逻辑）

**Files:**
- Create: `src/app/workflow/revise-creative-assets-with-ocelot.ts`
- Modify: `src/app/workflow/stages/script.stage.ts`
- Modify: `src/app/workflow/workflow-events.ts`
- Test: `tests/revise-creative-assets-with-ocelot.spec.ts`

**Step 1: 实现功能**
- Ocelot: CreativePlan -> 调度 Kitten/Cub -> 审稿 -> 改稿，最多 3 轮。
- 超限后继续渲染并写 warning 到 review-log。

**Step 2: 验证**
Run: `pnpm test -- tests/revise-creative-assets-with-ocelot.spec.ts`  
Expected: 轮次与审稿状态符合设计。

### Task 12: 接入 workflow 主链（start/ports/runtime/publish）

**Files:**
- Modify: `src/app/workflow/workflow-ports.ts`
- Modify: `src/app/workflow/start-story-run.ts`
- Modify: `src/app/workflow/workflow-runtime.ts`
- Modify: `src/app/workflow/stages/publish.stage.ts`
- Modify: `src/tools/artifacts/publish-artifacts.ts`
- Modify: `src/tools/artifacts/run-summary.ts`
- Test: `tests/workflow-contract.spec.ts`
- Test: `tests/start-story-run.e2e.spec.ts`

**Step 1: 实现功能**
- 在 runtime 与 summary 增加 `creativePlan/visualScript/reviewLog/musicMid/musicWav` 路径。
- 让 publish 阶段可收敛并输出上述产物路径。

**Step 2: 验证**
Run: `pnpm test -- tests/workflow-contract.spec.ts tests/start-story-run.e2e.spec.ts tests/publish-artifacts.spec.ts`  
Expected: 主 workflow 可产生并追踪新产物路径。

### Task 13: 明确失败策略（Cub 降级 / 审稿超限）

**Files:**
- Modify: `src/app/workflow/stages/script.stage.ts`
- Modify: `src/app/workflow/revise-creative-assets-with-ocelot.ts`
- Test: `tests/start-story-run.e2e.spec.ts`

**Step 1: 实现功能**
- Cub 失败时降级为无配乐渲染并记录日志。
- 审稿超限时继续渲染并记录 warning。

**Step 2: 验证（P4 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 失败策略与全量回归通过。

---

## P5：SoundFont 合成链路 + Remotion 音频合并

前置依赖：P4 已输出 `music.mid` 与新产物路径  
可独立验证：给定 `music.mid` 可产出 `music.wav` 并参与视频合成

### Task 14: 实现 FluidSynth 合成工具

**Files:**
- Create: `src/tools/audio/midi-to-wav-fluidsynth.ts`
- Create: `src/tools/audio/audio-pipeline.ts`
- Modify: `src/tools/index.ts`
- Test: `tests/midi-to-wav-fluidsynth.spec.ts`

**Step 1: 实现功能**
- 封装 `fluidsynth -ni <sf2> <mid> -F <wav> -r 44100` 命令执行。
- SoundFont 缺失/命令失败时抛错并保留 `music.mid`。

**Step 2: 验证**
Run: `pnpm test -- tests/midi-to-wav-fluidsynth.spec.ts`  
Expected: 成功路径与失败路径可复现。

### Task 15: 扩展渲染入口传递音频资产

**Files:**
- Modify: `src/app/workflow/stages/render.stage.ts`
- Modify: `src/tools/render/render-by-template.ts`
- Modify: `src/tools/render-assets/stage-remotion-assets.ts`
- Test: `tests/render-by-template.spec.ts`
- Test: `tests/stage-remotion-assets.spec.ts`

**Step 1: 实现功能**
- 让渲染入口可接收并 stage 音频资产。
- 保持无音频场景可渲染（Cub 降级路径）。

**Step 2: 验证**
Run: `pnpm test -- tests/render-by-template.spec.ts tests/stage-remotion-assets.spec.ts`  
Expected: 图像+音频资源均可被模板消费。

### Task 16: 更新 Remotion 模板（音轨 + 总时长策略）

**Files:**
- Modify: `src/templates/remotion/StoryComposition.schema.ts`
- Modify: `src/templates/remotion/StoryComposition.logic.ts`
- Modify: `src/templates/remotion/StoryComposition.tsx`
- Modify: `src/templates/remotion/StoryRoot.tsx`
- Test: `tests/StoryComposition.spec.ts`

**Step 1: 实现功能**
- 模板 props 增加音频字段。
- 实现“音视频取最大时长”规则并在 composition 时长中生效。
- 在组件中挂载音频轨。

**Step 2: 验证**
Run: `pnpm test -- tests/StoryComposition.spec.ts tests/remotion-renderer-tuning.spec.ts`  
Expected: 时长计算和渲染参数通过。

### Task 17: 发布新增产物

**Files:**
- Modify: `src/app/workflow/stages/publish.stage.ts`
- Modify: `src/tools/artifacts/publish-artifacts.ts`
- Modify: `src/tools/artifacts/run-summary.ts`
- Test: `tests/publish-artifacts.spec.ts`

**Step 1: 实现功能**
- 将 `creative-plan.json`、`visual-script.json`、`review-log.json`、`music.mid`、`music.wav` 纳入 summary。

**Step 2: 验证（P5 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 音频链路与产物发布全量通过。

---

## P6：删除 Lynx、清理旧代码、更新文档

前置依赖：P4 已完成 Ocelot 审稿替代  
可独立验证：仓库中不再有 Lynx 运行入口与测试依赖

### Task 18: 删除 Lynx 代码与合同

**Files:**
- Delete: `src/agents/lynx/index.ts`
- Delete: `src/agents/lynx/lynx.client.ts`
- Delete: `src/agents/lynx/lynx.prompt.ts`
- Delete: `src/agents/lynx/lynx.schema.ts`
- Delete: `src/agents/lynx/lynx.validate.ts`
- Delete: `src/contracts/lynx-review.types.ts`
- Delete: `src/app/workflow/revise-render-script-with-lynx.ts`
- Modify: `src/app/workflow/stages/script.stage.ts`

**Step 1: 实现功能**
- 清理 Lynx 相关 import/type/分支与遗留调用。

**Step 2: 验证**
Run: `pnpm test -- tests/start-story-run.spec.ts tests/workflow-contract.spec.ts`  
Expected: 无 Lynx 依赖残留。

### Task 19: 删除 Lynx 入口（CLI/API/TUI）

**Files:**
- Modify: `src/pipeline.ts`
- Modify: `src/app/tui/render-story.command.ts`
- Modify: `src/app/tui/render-story.tui.ts`
- Modify: `README.md`
- Modify: `AGENTS.md`

**Step 1: 实现功能**
- 删除 `--lynx-review` 参数与相关说明。
- 删除 RunSummary 中 Lynx 字段展示。

**Step 2: 验证**
Run: `pnpm test -- tests/render-story.command.spec.ts`  
Expected: CLI 参数与输出行为更新正确。

### Task 20: 删除旧测试并补新回归

**Files:**
- Delete: `tests/revise-render-script-with-lynx.spec.ts`
- Delete: `tests/lynx-review.validator.spec.ts`
- Modify: `tests/start-story-run.e2e.spec.ts`
- Modify: `tests/agent-output-schema.spec.ts`
- Modify: `tests/prompts-language.spec.ts`
- Create: `tests/ocelot-creative-director-loop.spec.ts`

**Step 1: 实现功能**
- 删除 Lynx 专属测试。
- 用 Ocelot 创意总监循环测试替代原审稿闭环覆盖。

**Step 2: 验证**
Run: `pnpm test -- tests/ocelot-creative-director-loop.spec.ts tests/start-story-run.e2e.spec.ts tests/agent-output-schema.spec.ts tests/prompts-language.spec.ts`  
Expected: 新测试覆盖核心行为且无 Lynx 断言。

### Task 21: 文档收口

**Files:**
- Modify: `.github/docs/LihuaCat未来.md`
- Modify: `.github/docs/business-logic.md`
- Modify: `README.md`

**Step 1: 实现功能**
- 同步 Ocelot/Kitten/Cub 新职责、产物清单、FluidSynth 依赖、失败策略。

**Step 2: 验证（P6 Gate）**
Run: `pnpm test && pnpm run build`  
Expected: 文档与代码一致，全量回归通过。

---

## 统一执行规则

1. 每个 Task 完成后先跑该 Task 的局部验证，再进入下一个 Task。
2. 每个 P 分组完成后必须执行 `pnpm test && pnpm run build`。
3. 若需要提交，建议按任务粒度原子提交：`<type>: taskN - <summary>`。
4. 本次为“完全重构”模式：新链路稳定后删除旧链路与旧测试，不保留兼容层。

## 不确定项（开工前确认）

1. MIDI 写入库选型：`midi-writer-js` 还是 `@tonejs/midi`。
2. SoundFont 默认路径策略：环境变量（如 `LIHUACAT_SOUNDFONT_PATH`）或 CLI 参数。
3. 首版音频产物是否固定仅 `music.wav`，还是同时支持 `.mp3`。
