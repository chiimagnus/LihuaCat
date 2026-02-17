# Audit: P2 Lynx 审稿 + 修改循环（按计划执行审查）

> Using `plan-task-auditor`  
> Repo root: `/Users/chii_magnus/Github_OpenSource/LihuaCat`  
> Target plan: `.github/plans/2026-02-17-p2-lynx-review-loop-implementation-plan.md`

本报告按 “先记录 Findings，再修复” 的流程输出：先审查计划与落地代码的一致性，再进入修复与验证。

---

## TODO board（13 tasks）

1. Task 1: 定义 Lynx 审稿契约类型
2. Task 2: Lynx prompt 与 output schema（STRICT JSON）
3. Task 3: LynxAgentClient（Codex tool-call 线程式 client）
4. Task 4: LynxReview 结构校验（runtime validator）
5. Task 5: 扩展 Ocelot：支持 revisionNotes（破坏性调整）
6. Task 6: 新增“脚本质量门槛”use-case：循环收敛控制
7. Task 7: 扩展 runtime artifacts：新增 Lynx 产物路径与轮次文件命名
8. Task 8: 重构 stages：用“脚本质量门槛 stage”替换旧 ocelot.stage
9. Task 9: Workflow 事件与 TUI 适配（契约更新）
10. Task 10: 接入 pipeline/command/flow（新增 Lynx 依赖，破坏性更新对外 API）
11. Task 11: 扩展 RunSummary / publish artifacts（暴露 Lynx 产物路径，便于调试）
12. Task 12: 更新 workflow e2e：覆盖“二轮通过/超轮次定稿/lynx失败终止”
13. Task 13: 全量回归（构建 + 测试）

---

## Task-to-file map（计划 → 实际落地文件）

- Task 1 → `src/contracts/lynx-review.types.ts`
- Task 2 → `src/prompts/lynx-review.prompt.ts`
- Task 3 → `src/domains/lynx/lynx-agent.client.ts`, `src/pipeline.ts`
- Task 4 → `src/domains/lynx/validate-lynx-review.ts`, `tests/lynx-review.validator.spec.ts`
- Task 5 → `src/domains/render-script/ocelot-agent.client.ts`, `src/prompts/render-script.prompt.ts`
- Task 6 → `src/domains/render-script/revise-render-script-with-lynx.ts`, `tests/revise-render-script-with-lynx.spec.ts`
- Task 7 → `src/workflow/workflow-runtime.ts`
- Task 8 → `src/workflow/stages/script.stage.ts`, `src/workflow/start-story-run.ts`, `src/workflow/workflow-events.ts`（并删除 `src/workflow/stages/ocelot.stage.ts`）
- Task 9 → `tests/workflow-contract.spec.ts`（事件序列适配）
- Task 10 → `src/workflow/start-story-run.ts`, `src/flows/create-story-video/create-story-video.flow.ts`, `src/commands/render-story.command.ts`, `tests/create-story-video.flow.spec.ts`
- Task 11 → `src/domains/artifact-publish/build-run-summary.ts`, `src/domains/artifact-publish/publish-artifacts.ts`, `src/workflow/stages/publish.stage.ts`, `src/commands/tui/render-story.tui.ts`
- Task 12 → `tests/start-story-run.e2e.spec.ts`
- Task 13 →（验证命令记录见下方 Validation log）

---

## Findings（Open）

## Finding F-01

- Task: `Task 10: 接入 pipeline/command/flow（新增 Lynx 依赖，破坏性更新对外 API）`
- Severity: `Medium`
- Status: `Open`
- Location: `src/workflow/start-story-run.ts:53`
- Summary: `RunStoryWorkflowV2Input.lynxAgentClient` 在类型上是可选，但 runtime 实际强制要求（缺失会 throw），与“质量门槛”定位不一致，且不利于编译期约束。
- Risk: 调用方可能遗漏注入 Lynx 导致运行时失败；并且“必需依赖”被表达成可选，降低可维护性/可发现性。
- Expected fix: 将 `lynxAgentClient` 改为必填字段（workflow/flow/command 的输入类型同步），并移除或简化 runtime `if (!lynxAgentClient)` 检查。
- Validation: `pnpm run check`；`pnpm test tests/workflow-contract.spec.ts`；`pnpm test tests/start-story-run.e2e.spec.ts`
- Resolution evidence: TBD

## Finding F-02

- Task: `Task 2: Lynx prompt 与 output schema（STRICT JSON）`
- Severity: `Low`
- Status: `Open`
- Location: `src/prompts/lynx-review.prompt.ts:55`
- Summary: `lynxReviewOutputSchema` 对可选字符串字段（`summary/evidence/sceneId/photoRef/subtitle`）未加 `minLength` 约束，但 runtime validator 要求这些字段一旦出现必须非空；schema 与 validator 不完全一致。
- Risk: Lynx 返回空字符串时会通过 output schema，但被 validator 判为 invalid 并抛 `LynxAgentResponseParseError`，造成不必要的失败与重试成本。
- Expected fix: 在 output schema 中给上述可选字符串字段加 `minLength: 1`（保持与 validator 语义一致）。
- Validation: `pnpm test tests/lynx-review.validator.spec.ts`
- Resolution evidence: TBD

## Finding F-03

- Task: `Task 6: 新增“脚本质量门槛”use-case：循环收敛控制`
- Severity: `Low`
- Status: `Open`
- Location: `src/domains/render-script/revise-render-script-with-lynx.ts:15`
- Summary: 实现中新增了 “Ocelot 语义校验失败自动重试（maxOcelotRetriesPerRound）” 与 `RenderScriptGenerationFailedError`（对应提交 `fix: task14 ...`），但该行为未在计划中描述，计划与实际存在 drift。
- Risk: 审查者仅看计划无法预期“每轮可能多次调用 Ocelot”；也会造成任务编号/提交信息与计划不一致（Task 14 不在计划内）。
- Expected fix: 更新计划文档（或在计划中增补一个 Task / Addendum）明确该策略：触发条件、默认重试次数、失败时错误形态。
- Validation: N/A（文档一致性修复）；回归 `pnpm test tests/revise-render-script-with-lynx.spec.ts`
- Resolution evidence: TBD

## Finding F-04

- Task: `Task 11: 扩展 RunSummary / publish artifacts（暴露 Lynx 产物路径，便于调试）`
- Severity: `Low`
- Status: `Open`
- Location: `tests/render-story.command.spec.ts:29`
- Summary: `tests/render-story.command.spec.ts` 中多处 `workflowImpl` stub 返回的 `RunSummary` 缺少新字段（`lynxReviewPaths/lynxPromptLogPaths/ocelotRevisionPaths`）。测试运行依赖 mock TUI 不会触发，但属于契约漂移。
- Risk: 未来若在测试中切换为真实 TUI/或增加对 summary 的字段访问，会出现隐藏的运行时错误；同时降低测试作为契约样例的可靠性。
- Expected fix: 补齐所有 stub summary 的这三个数组字段（最小值为 `[]`）。
- Validation: `pnpm test tests/render-story.command.spec.ts`
- Resolution evidence: TBD

---

## Fix log（空，等待进入修复阶段）

---

## Validation log（空，等待进入修复阶段）

---

## Final status / residual risks

- 当前处于 Findings 已落盘阶段，尚未进入修复。

