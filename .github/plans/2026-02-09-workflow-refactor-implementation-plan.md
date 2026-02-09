# LihuaCat 工作流重构实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。

**Goal（目标）:** 基于 KISS/YAGNI/DRY/WET/SOLID/LoD/SoC/SLAP 对 `story-pipeline`、`story-console`、`story-video` 做一次完整重构，允许破坏性调整，并在实施过程中同步清理旧实现与冗余代码。

**Non-goals（非目标）:**
- 不保留兼容层、过渡适配器或双轨实现。
- 不修改素材输入规则（第一层扫描、格式限制、20 张上限）。
- 不引入新的框架或运行时依赖。
- 不做跨包大规模架构迁移（如 monorepo 构建体系变更）。

**Approach（方案）:**
- 采用“切断式重构（cut-over）”：新结构完成即替换旧结构，不保留向后兼容代码路径。
- 按“业务能力”拆分 stage（收集素材/生成脚本/渲染循环/发布产物），保持单一职责与单层抽象。
- 通过“端口 + 实现注入”落实依赖倒置，减少 orchestrator 对细节实现的直接感知。
- 采用 WET（Write Everything Twice）：相同模式至少出现两处后再抽象，避免过度设计。
- 每个任务必须包含“遗留代码清理”步骤：删除旧文件、旧导出、旧测试、旧注释。

**Principle Guardrails（原则护栏）:**
- KISS：优先删除分支与嵌套，不通过“新增层级”伪装简单。
- YAGNI：只抽象当前已出现的变化点，不预留未来模式。
- DRY + WET：同类逻辑至少出现 2 次后再合并；抽象前先接受有限重复。
- SRP + SoC + SLAP：编排层不写细节，阶段层不处理跨阶段职责。
- OCP + DIP + ISP：高层依赖小接口，新增实现通过注入扩展，不改编排主干。
- LSP：同一接口的替换实现必须通过同一契约测试，行为可替换。
- LoD：跨包只走门面导出，避免深链路访问内部细节。
- No Compatibility：不引入 deprecated shim / fallback 分支；保留旧路径视为未完成。

**Acceptance（验收）:**
- 新架构下核心行为可用：成功路径、失败路径、重试与退出语义由新测试重新定义并通过。
- `story-console` 命令层输出在新规范内一致（允许格式性调整，但必须有测试覆盖）。
- 关键模块依赖方向清晰：`workflow` 依赖抽象端口，不反向耦合 CLI。
- 相关测试通过：`pnpm --filter @lihuacat/story-pipeline test`、`pnpm --filter @lihuacat/story-console test`。
- 每个任务完成后均通过“原则检查清单（见文末）”。
- 不存在已废弃但仍保留的实现文件、导出符号、死代码分支。

---

## Plan A（主方案）

### P1（最高优先级）：先清点并删除遗留，再建立新骨架

### ✅Task 0: 建立“遗留代码清理清单”（必须先做）

**Files:**
- Create: `.github/docs/refactor-legacy-inventory.md`
- Modify: `packages/story-pipeline/src/workflow/start-story-run.ts`（仅标注待迁移边界）
- Modify: `packages/story-console/src/commands/render-story.command.ts`（仅标注待迁移边界）

**Step 1: 先定义本任务最小验收（1-3 条）**
- 列出待删除文件/符号/测试（路径级别），并注明替代落点。
- 标记“可直接删”和“迁移后删”两类遗留项。
- 清单纳入后续每个 Task 的完成条件。

**Step 2: 输出清单**
- 建立 Legacy Inventory 文档，记录 owner、替代点、删除时机。

**Step 3: 验证**

Run: `rg -n "legacy|deprecated|向后兼容|兼容层|fallback" packages/story-pipeline packages/story-console packages/story-video .github/docs/refactor-legacy-inventory.md`

Expected: 匹配仅出现在 `.github/docs/refactor-legacy-inventory.md` 或明确保留说明中

---

### ✅Task 1: 建立新架构契约测试（不依赖旧实现）

**Files:**
- Modify: `packages/story-pipeline/src/workflow/start-story-run.e2e.spec.ts`
- Modify: `packages/story-console/src/commands/render-story.command.spec.ts`
- Create: `packages/story-pipeline/src/workflow/workflow-contract.spec.ts`

**Step 1: 先定义本任务最小验收（1-3 条）**
- 新工作流契约由测试定义（阶段事件、渲染循环、失败退出）。
- CLI 输出契约由测试定义（关键字段和错误映射）。
- 测试命名与断言不引用“旧实现必须一致”表述。

**Step 2: 补齐契约测试（只测外部可观察行为）**
- 为工作流增加“事件顺序 + 产物路径 + 失败退出”契约测试。
- 为 CLI 增加“参数解析 + 错误映射 + 进度输出”契约测试。

**Step 3: 运行聚焦验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/workflow-contract.spec.ts`

Expected: PASS

Run: `pnpm --filter @lihuacat/story-console test -- src/commands/render-story.command.spec.ts`

Expected: PASS

---

### ✅Task 2: 提取工作流端口与上下文并删除旧同位逻辑（DIP + ISP）

**Files:**
- Create: `packages/story-pipeline/src/workflow/workflow-ports.ts`
- Create: `packages/story-pipeline/src/workflow/workflow-runtime.ts`
- Modify: `packages/story-pipeline/src/workflow/start-story-run.ts`
- Test: `packages/story-pipeline/src/workflow/start-story-run.e2e.spec.ts`

**Step 1: 先定义本任务最小验收（1-3 条）**
- `start-story-run.ts` 不再直接承载所有依赖细节类型。
- 依赖注入接口最小化（按用途拆分，不暴露无关方法）。
- 替换实现满足同一行为契约（LSP）。

**Step 2: 实现最小重构**
- 把依赖类型统一到 `workflow-ports.ts`（收集、脚本生成、渲染、发布）。
- 把运行时路径与日志集合提取到 `workflow-runtime.ts`。
- `start-story-run.ts` 仅保留 orchestrator 级别编排逻辑。
- 删除已被端口/上下文替代的旧类型与辅助函数，避免双轨。

**Step 3: 运行聚焦验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/start-story-run.e2e.spec.ts`

Expected: PASS

Run: `pnpm --filter @lihuacat/story-pipeline build`

Expected: PASS

---

### ✅Task 3: 按业务阶段拆文件并切断旧入口（SoC + SRP + Single Level of Abstraction）

**Files:**
- Create: `packages/story-pipeline/src/workflow/stages/collect-images.stage.ts`
- Create: `packages/story-pipeline/src/workflow/stages/generate-script.stage.ts`
- Create: `packages/story-pipeline/src/workflow/stages/render.stage.ts`
- Create: `packages/story-pipeline/src/workflow/stages/publish.stage.ts`
- Modify: `packages/story-pipeline/src/workflow/start-story-run.ts`
- Test: `packages/story-pipeline/src/workflow/start-story-run.e2e.spec.ts`

**Step 1: 先定义本任务最小验收（1-3 条）**
- `start-story-run.ts` 只描述阶段调用顺序，不含阶段内分支细节。
- 每个 stage 文件只做一件事，输入输出显式化。
- 渲染循环语义（template/ai_code/exit）不变。

**Step 2: 实现最小拆分**
- 先拆 `collect` 与 `generate`，验证通过后再拆 `render` 与 `publish`。
- 完成每一段拆分后删除旧调用路径，不保留 fallback。

**Step 3: 运行验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/start-story-run.e2e.spec.ts`

Expected: PASS

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/render-choice/render-choice-machine.spec.ts`

Expected: PASS

---

### P2：减少跨包耦合与知识泄漏（LoD + OCP）

### ✅Task 4: 为 pipeline 提供稳定门面并删除深层路径依赖

**Files:**
- Create: `packages/story-pipeline/src/index.ts`
- Modify: `packages/story-console/src/commands/render-story.command.ts`
- Modify: `packages/story-console/src/flows/create-story-video/create-story-video.flow.ts`
- Test: `packages/story-console/src/commands/render-story.command.spec.ts`
- Test: `packages/story-console/src/flows/create-story-video/create-story-video.flow.spec.ts`

**Step 1: 先定义本任务最小验收（1-3 条）**
- `story-console` 不再引用多段 `../../../../story-pipeline/...` 深路径。
- 对 console 暴露的 API 面保持最小且稳定。
- console 相关测试通过，且调用路径符合 LoD（仅经门面）。

**Step 2: 最小实现**
- 由 `story-pipeline/src/index.ts` 暴露 workflow 与必要类型。
- console 仅依赖门面导出，不直接依赖 pipeline 内部目录结构。
- 删除 console 内已迁移完成的深层相对路径 import。

**Step 3: 验证**

Run: `pnpm --filter @lihuacat/story-console test`

Expected: PASS

Run: `pnpm --filter @lihuacat/story-pipeline test`

Expected: PASS

---

### ✅Task 5: 统一错误映射与输出边界（KISS + DRY）

**Files:**
- Create: `packages/story-console/src/commands/render-story.error-mapper.ts`
- Modify: `packages/story-console/src/commands/render-story.command.ts`
- Test: `packages/story-console/src/commands/render-story.command.spec.ts`

**Step 1: 先定义本任务最小验收（1-3 条）**
- 命令层错误处理从主函数中拆出，主流程聚焦 happy path。
- 相同错误文案组装逻辑不重复。
- 已有错误输出快照/断言保持通过。

**Step 2: 实现**
- 提取错误类型到文案映射函数。
- `runRenderStoryCommand` 仅做调用与写出，不承担复杂分支拼接。
- 删除旧错误拼接分支，禁止保留“新旧两套”处理逻辑。

**Step 3: 验证**

Run: `pnpm --filter @lihuacat/story-console test -- src/commands/render-story.command.spec.ts`

Expected: PASS

---

### P3：文档与回归收口

### ✅Task 6: 输出“重构后代码导读”与原则落地说明

**Files:**
- Modify: `.github/docs/business-logic.md`
- Create: `.github/docs/workflow-refactor-map.md`

**Step 1: 先定义本任务最小验收（1-3 条）**
- 文档可回答“入口在哪、主流程在哪、每个 stage 负责什么”。
- 每个设计原则至少给出一个落地点（文件/模块）。
- 新同学可按文档在 10 分钟内找到主流程与关键测试。

**Step 2: 实现**
- 在业务文档加入“重构后导航图 + 依赖方向图”。
- 补充“原则 -> 代码位置”清单。
- 在文档中明确“已删除的旧入口/旧模块”与替代位置。

**Step 3: 验证**

Run: `pnpm -r test`

Expected: PASS

---

## 回归策略（每个优先级结束后执行）

- P1 结束：`pnpm --filter @lihuacat/story-pipeline test` + `pnpm --filter @lihuacat/story-pipeline build`
- P2 结束：`pnpm --filter @lihuacat/story-console test` + `pnpm --filter @lihuacat/story-pipeline test`
- P3 结束：`pnpm -r test` + `pnpm -r build`

## 旧代码清理策略（强制）

- 每个 Task 完成前必须执行一次“引用扫描”，确认无悬空旧引用。
- 删除旧代码时同步删除对应旧测试或迁移到新契约测试，禁止无主测试残留。
- 不允许保留 `legacy`/`deprecated` 命名的临时模块跨 Task 存活。
- 未完成清理视为 Task 未完成。

## 不确定项（执行前需确认）
- 已确认：本轮覆盖 `story-video` 模板层重构（非仅 pipeline + console）。
- 已确认：CLI 输出允许进行破坏性文案调整（测试同步更新）。

## 原则检查清单（每个 Task 完成后打勾）

- [ ] KISS：本任务是否降低了条件分支/缩短了主路径阅读长度？
- [ ] YAGNI：是否没有引入当前未使用的抽象、参数或配置？
- [ ] DRY：是否仅对“已重复 >= 2 次”的逻辑做抽象？
- [ ] WET：是否允许了合理重复，避免过早提炼工具层？
- [ ] SRP：每个新函数/模块是否只有一个变化原因？
- [ ] OCP：新增能力是否通过扩展点实现，避免改动稳定主流程？
- [ ] LSP：替换实现是否通过同一契约测试？
- [ ] ISP：接口是否小而专一，调用方只依赖必要能力？
- [ ] DIP：高层模块是否仅依赖抽象端口？
- [ ] LoD：是否避免跨层、跨包深路径调用？
- [ ] SoC：编排、领域、基础设施关注点是否明确分离？
- [ ] SLAP：同一函数内语句是否处于同一抽象层级？
- [ ] 清理完成：本任务涉及的旧文件/旧导出/旧分支是否已删除？
