# 2026-02-23 Music Agent + Ocelot 架构升级审计报告

- 审计模式：`plan-task-auditor`
- 目标计划：`.github/plans/2026-02-23-music-agent-ocelot-architecture-upgrade-implementation-plan.md`
- 仓库根目录：`/Users/chii_magnus/Github_OpenSource/LihuaCat`
- 审计阶段：`Read-only`（本节不改代码）

## TODO board (N=21)

1. Task 1: 新增 CreativePlan / VisualScript / MIDI / ReviewLog 合同 - `Reviewed`
2. Task 2: RenderScript 音频字段 - `Reviewed`
3. Task 3: 合同与 schema 回归 - `Reviewed`
4. Task 4: Cub sub-agent - `Reviewed`
5. Task 5: MIDI JSON -> .mid - `Reviewed`
6. Task 6: 依赖与导出 - `Reviewed`
7. Task 7: Kitten sub-agent - `Reviewed`
8. Task 8: VisualScript + 音频合并 - `Reviewed`
9. Task 9: Prompt 语言规则 - `Reviewed`
10. Task 10: Ocelot 创意总监职责 - `Reviewed`
11. Task 11: Ocelot 审稿循环 - `Reviewed`
12. Task 12: workflow 主链接入 - `Reviewed`
13. Task 13: 失败策略（Cub 降级 / 审稿超限） - `Reviewed`
14. Task 14: FluidSynth 工具 - `Reviewed`
15. Task 15: 渲染入口音频资产 - `Reviewed`
16. Task 16: Remotion 音轨与时长策略 - `Reviewed`
17. Task 17: 发布新增产物 - `Reviewed`
18. Task 18: 删除 Lynx 代码与合同 - `Reviewed`
19. Task 19: 删除 Lynx CLI/API/TUI 入口 - `Reviewed`
20. Task 20: 删除旧测试并补新回归 - `Reviewed`
21. Task 21: 文档收口 - `Reviewed`

## Task-to-file map

1. Task 1 -> `src/contracts/creative-plan.types.ts`, `src/contracts/visual-script.types.ts`, `src/contracts/midi.types.ts`, `src/contracts/review-log.types.ts`
2. Task 2 -> `src/contracts/render-script.types.ts`, `src/agents/ocelot/ocelot.validate.ts`
3. Task 3 -> `tests/agent-output-schema.spec.ts`, `tests/workflow-contract.spec.ts`
4. Task 4 -> `src/agents/cub/*`, `tests/cub-agent.client.spec.ts`, `tests/cub.validate.spec.ts`
5. Task 5 -> `src/tools/audio/midi-json-to-mid.ts`, `tests/midi-json-to-mid.spec.ts`
6. Task 6 -> `package.json`, `pnpm-lock.yaml`, `src/pipeline.ts`
7. Task 7 -> `src/agents/kitten/*`, `tests/kitten-agent.client.spec.ts`, `tests/kitten.validate.spec.ts`
8. Task 8 -> `src/tools/render/merge-creative-assets.ts`, `src/tools/render/render-by-template.ts`, `tests/merge-creative-assets.spec.ts`
9. Task 9 -> `tests/prompts-language.spec.ts`
10. Task 10 -> `src/agents/ocelot/ocelot.client.ts`, `src/agents/ocelot/ocelot.prompt.ts`, `src/agents/ocelot/ocelot.schema.ts`, `src/agents/ocelot/ocelot.validate.ts`
11. Task 11 -> `src/app/workflow/revise-creative-assets-with-ocelot.ts`, `src/app/workflow/stages/script.stage.ts`
12. Task 12 -> `src/app/workflow/start-story-run.ts`, `src/app/workflow/workflow-runtime.ts`, `src/app/workflow/stages/publish.stage.ts`, `src/tools/artifacts/publish-artifacts.ts`
13. Task 13 -> `src/app/workflow/revise-creative-assets-with-ocelot.ts`, `tests/start-story-run.e2e.spec.ts`
14. Task 14 -> `src/tools/audio/midi-to-wav-fluidsynth.ts`, `src/tools/audio/audio-pipeline.ts`
15. Task 15 -> `src/tools/render/render-by-template.ts`, `src/tools/render-assets/stage-remotion-assets.ts`
16. Task 16 -> `src/templates/remotion/StoryComposition.*`, `src/templates/remotion/StoryRoot.tsx`
17. Task 17 -> `src/tools/artifacts/publish-artifacts.ts`, `src/tools/artifacts/run-summary.ts`
18. Task 18 -> `src/agents/lynx/* (deleted)`, `src/app/workflow/stages/script.stage.ts`
19. Task 19 -> `src/pipeline.ts`, `src/app/tui/render-story.command.ts`, `src/app/tui/render-story.tui.ts`
20. Task 20 -> `tests/start-story-run.e2e.spec.ts`, `tests/agent-output-schema.spec.ts`, `tests/prompts-language.spec.ts`, `tests/ocelot-creative-director-loop.spec.ts`
21. Task 21 -> `README.md`, `.github/docs/LihuaCat未来.md`, `.github/docs/business-logic.md`

## Findings (Open first)

## Finding F-01

- Task: `Task 14 + Task 15 + Task 16 + Task 17`
- Severity: `High`
- Status: `Resolved`
- Location: `src/app/workflow/stages/script.stage.ts:102`
- Summary: 创意链路在拿到 Cub 的 MIDI JSON 后，没有执行 MIDI JSON -> `music.mid` -> `music.wav` 的工具链，也没有把音轨注入 `RenderScript.audioTrack`。
- Risk: 产物目录可能缺失 `music.mid`/`music.wav`，Remotion 音轨合成不会生效，且与计划验收“音视频总时长取最大值”不一致。
- Expected fix: 在创意链路中接入音频流水线（至少保证成功路径写出 `music.mid`/`music.wav` 并注入 audioTrack；Cub fallback 继续允许无音频）。
- Validation: `pnpm test -- tests/start-story-run.e2e.spec.ts tests/ocelot-creative-director-loop.spec.ts tests/render-by-template.spec.ts`
- Resolution evidence: `runScriptStage 接入 runAudioPipelineImpl，creative 成功路径写出 mid/wav 并注入 audioTrack；相关回归通过。`

## Finding F-02

- Task: `Task 17`
- Severity: `Medium`
- Status: `Resolved`
- Location: `src/app/workflow/stages/publish.stage.ts:34`
- Summary: publish 阶段无条件把 `musicMidPath`/`musicWavPath` 放入 summary，即使目标文件未生成也会“看起来存在”。
- Risk: 上层调用方与文档会误判音频产物已成功发布，掩盖真实失败或未执行音频链路的问题。
- Expected fix: 仅在文件存在时发布对应路径；无音频时返回 `undefined`。
- Validation: `pnpm test -- tests/publish-artifacts.spec.ts tests/start-story-run.e2e.spec.ts`
- Resolution evidence: `publish.stage 新增文件存在性检查；Cub fallback 场景 summary.musicMidPath/musicWavPath 断言为 undefined。`

## Fix log

- 修复 F-01：`src/app/workflow/stages/script.stage.ts` 接入 `runAudioPipelineImpl`，成功路径注入 `audioTrack`，并记录音频产物日志。
- 修复 F-01：`src/app/workflow/workflow-ports.ts` 增加 `runAudioPipelineImpl` 端口并接入 `start-story-run`。
- 修复 F-01：`src/app/workflow/revise-creative-assets-with-ocelot.ts` 增加 `audioAvailable`，显式区分 Cub fallback 无音频路径。
- 修复 F-01/F-02：更新 `tests/start-story-run.e2e.spec.ts`、`tests/ocelot-creative-director-loop.spec.ts`、`tests/workflow-contract.spec.ts` 覆盖音频成功/降级行为。
- 修复 F-02：`src/app/workflow/stages/publish.stage.ts` 按文件存在性发布 `musicMidPath/musicWavPath`。

## Validation log

- `pnpm test -- tests/start-story-run.e2e.spec.ts tests/ocelot-creative-director-loop.spec.ts tests/workflow-contract.spec.ts tests/render-by-template.spec.ts tests/publish-artifacts.spec.ts` -> `PASS (14/14)`
- `pnpm test && pnpm run build` -> `PASS (137 tests + tsc build)`

## Final status and residual risks

- 当前 finding 状态：`2/2 Resolved`。
- 无阻塞项；剩余风险为环境依赖型（运行机需安装 `fluidsynth` 与可用 SoundFont）。
