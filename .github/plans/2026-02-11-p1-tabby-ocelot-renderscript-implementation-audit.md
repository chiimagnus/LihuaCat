# P1（Tabby → StoryBrief → Ocelot → RenderScript → Remotion）审查报告

Scope:
- Plan: `.github/plans/2026-02-11-p1-tabby-ocelot-renderscript-implementation-plan.md`
- Docs: `.github/docs/LihuaCat 产品地基.md`, `.github/docs/business-logic.md`
- Baseline commit: `121f0da`

---

## TODO board（按 Task 一条）

- [x] Task 1: StoryBrief contract + validation
- [x] Task 2: RenderScript contract + semantic validation
- [x] Task 3: Tabby turn output contract + validation
- [x] Task 4: Tabby agent client + prompt
- [x] Task 5: Tabby session (TUI) + jsonl logging
- [x] Task 6: Generate StoryBrief (post-confirm AI call)
- [x] Task 7: Ocelot agent client (StoryBrief → RenderScript) + debug artifacts
- [x] Task 8: Workflow stages (collect → tabby → ocelot → render → publish)
- [x] Task 9: CLI flow rewrite (remove askStyle/askPrompt/mode selection)
- [x] Task 10: Runtime artifacts refactor (story-brief/render-script/jsonl + ocelot debug)
- [x] Task 11: Remotion template props consume RenderScript
- [x] Task 12: Transitions (cut/fade/dissolve/slide)
- [x] Task 13: Ken Burns (scale + pan)
- [x] Task 14: `render-by-template` consumes RenderScript + staged assets mapping
- [x] Task 15: Delete story-script pipeline (contracts/domains/prompts/tests)
- [x] Task 16: Delete `ai_code` + render mode selection
- [x] Task 17: Update README + business-logic

Extra TODOs（非 Task 但影响验收/一致性）:
- [ ] Sync docs vs code: `internalNotes` requiredness
- [ ] Sync docs vs code: `RenderTransition.direction` (slide only)
- [ ] Align Ocelot `outputSchema` with RenderScript contract (transition/kenBurns)
- [ ] Ensure failures always write `error.log` (not only render failure)
- [ ] Prevent duration rounding drift (seconds → frames)

---

## Task-to-file map（入口索引）

- Task 1: `src/contracts/story-brief.types.ts`, `src/domains/story-brief/validate-story-brief.ts`, `tests/validate-story-brief.spec.ts`
- Task 2: `src/contracts/render-script.types.ts`, `src/domains/render-script/validate-render-script.ts`, `tests/validate-render-script.spec.ts`
- Task 3: `src/contracts/tabby-turn.types.ts`, `src/domains/tabby/validate-tabby-turn.ts`, `tests/validate-tabby-turn.spec.ts`
- Task 4: `src/domains/tabby/tabby-agent.client.ts`, `src/prompts/tabby-turn.prompt.ts`, `tests/tabby-agent.client.spec.ts`
- Task 5: `src/domains/tabby/tabby-session.ts`, `src/commands/tui/render-story.tui.ts`, `tests/tabby-session.spec.ts`
- Task 6: `src/domains/story-brief/generate-story-brief.ts`, `src/prompts/story-brief.prompt.ts`, `tests/generate-story-brief.spec.ts`
- Task 7: `src/domains/render-script/ocelot-agent.client.ts`, `src/prompts/render-script.prompt.ts`, `tests/ocelot-agent.client.spec.ts`
- Task 8–10: `src/workflow/start-story-run.ts`, `src/workflow/workflow-runtime.ts`, `src/workflow/stages/*.ts`, `tests/workflow-contract.spec.ts`
- Task 11–13: `src/story-template/*`, `tests/StoryComposition.spec.ts`
- Task 14: `src/domains/template-render/render-by-template.ts`, `src/domains/render-assets/stage-remotion-assets.ts`, `tests/render-by-template.spec.ts`, `tests/stage-remotion-assets.spec.ts`
- Task 15–16: `src/pipeline.ts`, `src/workflow/stages/render.stage.ts` + deletions, `tests/*`
- Task 17: `README.md`, `README.zh.md`, `.github/docs/business-logic.md`

---

## Findings（先记录，后修复）

## Finding F-01

- Task: `Task 3: 定义 Tabby 回合输出合同（outputSchema + 本地校验）`
- Severity: `Low`
- Status: `Open`
- Location: `.github/docs/LihuaCat 产品地基.md:303`
- Summary: 文档写 `internalNotes?`（可选），但代码与 outputSchema 把 `internalNotes` 作为必填字段。
- Risk: 文档/计划与实际合同不一致，后续调 prompt 或做 UI 时容易“按文档实现却跑不通”。
- Expected fix: 同步文档与计划：明确 `internalNotes` 为必填并会落盘（不展示）。
- Validation: `pnpm test`
- Resolution evidence: N/A

## Finding F-02

- Task: `Task 2: 新增场景化 RenderScript 合同与语义校验`
- Severity: `Low`
- Status: `Open`
- Location: `.github/docs/LihuaCat 产品地基.md:227`
- Summary: RenderScript 的 `RenderTransition` 文档缺少 `direction`（slide 需要方向），与实现（`src/contracts/render-script.types.ts`）不一致。
- Risk: Ocelot 输出/Renderer 消费端容易出现“实现有字段但文档没有字段”的沟通成本。
- Expected fix: 更新文档接口：`slide` 转场包含 `direction?: left|right|up|down`（或仅 slide 必填）。
- Validation: N/A（文档一致性）
- Resolution evidence: N/A

## Finding F-03

- Task: `Task 7: 实现 Ocelot agent client（StoryBrief → RenderScript）`
- Severity: `Medium`
- Status: `Open`
- Location: `src/prompts/render-script.prompt.ts:19`
- Summary: Ocelot 的 `outputSchema`/prompt 约束要求 `transition.direction` 与 `kenBurns` 总是存在，但 RenderScript 合同与校验允许它们（部分）可选/条件必填。
- Risk: “合同/校验/Schema”三者不一致；后续改动任意一处都可能引入隐藏兼容问题。
- Expected fix: 让 `renderScriptOutputSchema` 与 `src/contracts/render-script.types.ts` 对齐（建议用 `oneOf` 表达不同 transition 形态；`kenBurns` 保持可选但在 prompt 中建议给出）。
- Validation: `pnpm test`
- Resolution evidence: N/A

## Finding F-04

- Task: `Task 2: 新增场景化 RenderScript 合同与语义校验`
- Severity: `Medium`
- Status: `Open`
- Location: `src/story-template/StoryComposition.logic.ts:4`
- Summary: `durationSec` 允许小数，`secondsToFrames` 使用 `Math.round` 会导致 scenes 转成帧后总帧数可能不等于 30s@30fps 的 `900` 帧。
- Risk: 实际渲染可能出现尾帧黑屏/被截断/节奏漂移（语义校验通过但视觉结果不符合预期）。
- Expected fix: 在 `validateRenderScriptSemantics` 增加帧级校验（或限制 `durationSec` 为整数/可整除 fps 的分辨率）。
- Validation: `pnpm test`
- Resolution evidence: N/A

## Finding F-05

- Task: `Task 10: 重构 workflow runtime 产物：新增 StoryBrief/RenderScript 路径与 jsonl 追加写`
- Severity: `Medium`
- Status: `Open`
- Location: `src/workflow/start-story-run.ts:70`
- Summary: 当前只有渲染阶段失败会写入 `error.log`（`pushErrorLog`），Tabby/StoryBrief/Ocelot 阶段抛错时不会确保落盘 `error.log`，与验收“失败时包含 error.log”不完全一致。
- Risk: 失败现场不可回放，定位成本升高；验收条目可能在“早失败”场景下不满足。
- Expected fix: 在 `runStoryWorkflowV2` 顶层添加 `try/catch`：捕获异常后 `pushErrorLog(runtime, ...)` 并落盘必要上下文，再 rethrow。
- Validation: 新增/调整一个 e2e 测试覆盖“早失败写 error.log”，然后 `pnpm test`
- Resolution evidence: N/A

## Finding F-06

- Task: `Task 9: 重写/替换 CLI flow：去掉 askStyle/askPrompt/模式选择`
- Severity: `Low`
- Status: `Open`
- Location: `tests/render-story.command.spec.ts:135`
- Summary: 用例名仍写 “story script retries”，但实际覆盖的是 `StoryBriefGenerationFailedError`。
- Risk: 误导后续维护者/审阅者。
- Expected fix: 重命名该 test case（不改行为）。
- Validation: `pnpm test`
- Resolution evidence: N/A

---

## Fix log

TBD（必须在所有 Finding 记录完成后再进入修复阶段）

## Validation log

TBD

## Final status / residual risks

TBD

