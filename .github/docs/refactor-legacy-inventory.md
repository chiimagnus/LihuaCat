# Refactor Legacy Inventory

## 目标

该清单用于执行“完全重构 + 不保留兼容层”的删除计划。所有列出的项必须在对应阶段完成后删除，不允许跨阶段遗留。

## Scope

- 包含：`packages/story-pipeline`、`packages/story-console`、`packages/story-video`
- 原则：Cut-over（新实现落地即删旧实现），禁止双轨。

## A. 可直接删除（Delete Now）

| Item | Path | Reason | Replacement | Owner Stage | Status |
|---|---|---|---|---|
| 未被引用的包装层 | `packages/story-console/src/flows/create-story-video/use-create-story-video.ts` | 仅转发 `createStoryVideoFlow`，全仓库无调用 | 直接调用 `createStoryVideoFlow` | P1 Task 1 | Done（2026-02-09） |

## B. 迁移后删除（Delete After Migration）

| Item | Path | Reason | Replacement | Delete Gate | Owner Stage |
|---|---|---|---|---|---|
| CLI 深层跨包 import（命令层） | `packages/story-console/src/commands/render-story.command.ts` | 违反 LoD，耦合 pipeline 内部目录 | `@lihuacat/story-pipeline` 门面导出（`src/index.ts`） | 门面导出可用且命令测试通过 | P2 Task 4 |
| CLI 深层跨包 import（flow 层） | `packages/story-console/src/flows/create-story-video/create-story-video.flow.ts` | 违反 LoD，耦合 pipeline 内部类型与实现 | `@lihuacat/story-pipeline` 门面导出 | flow/command 测试通过 | P2 Task 4 |
| CLI 测试深层依赖 pipeline 内部错误类型 | `packages/story-console/src/commands/render-story.command.spec.ts` | 测试绑定内部结构，阻碍破坏性重构 | 通过命令层公开错误映射进行断言 | 错误映射模块落地 | P2 Task 5 |
| Pipeline 模板入口的跨包源码路径 | `packages/story-pipeline/src/domains/template-render/render-by-template.ts` (`templateEntryPointPath`) | 直接引用 `story-video/src` 内部路径 | 改为稳定入口常量/包级导出 | template render 测试通过 | P2 Task 4 + story-video track |
| 占位构建脚本（console） | `packages/story-console/package.json` (`build`) | placeholder 无真实构建价值 | 最小可用 build（或显式移除并在根脚本调整） | workspace build 可通过 | P3 |
| 占位构建脚本（video） | `packages/story-video/package.json` (`build`) | placeholder 无真实构建价值 | 最小可用 build（或显式移除并在根脚本调整） | workspace build 可通过 | P3 |

## C. 结构性清理目标（按模块）

### C1. Workflow Orchestrator
- Target: `packages/story-pipeline/src/workflow/start-story-run.ts`
- Cleanup Goal: 主文件仅保留阶段编排，不保留旧的同位 helper/分支实现。
- Delete Gate: 新 stages 文件接管后，旧 helper 0 残留。

### C2. CLI Command Boundary
- Target: `packages/story-console/src/commands/render-story.command.ts`
- Cleanup Goal: 参数解析、错误映射、prompt 会话拆分后，删除内联旧逻辑块。
- Delete Gate: 命令层测试通过且无重复错误拼接逻辑。

### C3. Story Video Template Boundary
- Targets:
  - `packages/story-video/src/story-template/StoryComposition.tsx`
  - `packages/story-video/src/story-template/StoryComposition.logic.ts`
  - `packages/story-video/src/story-template/StoryRoot.tsx`
- Cleanup Goal: 组件渲染、序列计算、schema 默认值职责清晰，去除跨层耦合点。
- Delete Gate: 模板测试与 pipeline template-render 测试同时通过。

## D. 执行时检查项

- 引用扫描：每次删除后运行 `rg` 检查是否存在悬空 import/符号。
- 测试归属：删除旧实现时同步删除旧测试或迁移断言。
- 命名约束：不允许遗留 `legacy`/`deprecated` 命名模块跨任务存活。
