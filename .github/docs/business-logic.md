# LihuaCat 业务全局地图（重构后）

## 1) 产品概述

LihuaCat 是本地优先的「图片 -> 故事短视频」生成工具。核心链路是：

1. 收集输入目录图片（仅第一层，`jpg/jpeg/png`，最多 20 张）
2. 调用用户本地 Codex 登录态生成结构化 `story-script`
3. 用户在 `template` 与 `ai_code` 两种渲染模式中选择
4. 本地 Remotion 渲染视频并发布产物

设计目标：
- 可读：编排、领域、渲染模板职责分离
- 可维护：阶段化（stages）与门面导出（facade）
- 可扩展：新增渲染策略通过端口注入，不改主编排骨架

## 2) 重构后架构

### `packages/story-console`
- 职责：CLI 参数解析、交互提示、进度输出、错误映射
- 入口：`packages/story-console/src/index.ts`
- 命令层：`packages/story-console/src/commands/render-story.command.ts`
- 错误映射：`packages/story-console/src/commands/render-story.error-mapper.ts`

### `packages/story-pipeline`
- 职责：业务编排核心（素材、脚本、渲染选择、产物发布）
- 门面：`packages/story-pipeline/src/index.ts`
- 编排入口：`packages/story-pipeline/src/workflow/start-story-run.ts`
- 阶段实现：
  - `packages/story-pipeline/src/workflow/stages/collect-images.stage.ts`
  - `packages/story-pipeline/src/workflow/stages/generate-script.stage.ts`
  - `packages/story-pipeline/src/workflow/stages/render.stage.ts`
  - `packages/story-pipeline/src/workflow/stages/publish.stage.ts`
- 端口与运行时：
  - `packages/story-pipeline/src/workflow/workflow-ports.ts`
  - `packages/story-pipeline/src/workflow/workflow-runtime.ts`
  - `packages/story-pipeline/src/workflow/workflow-events.ts`

### `packages/story-video`
- 职责：模板渲染相关组件与 schema
- 目录：`packages/story-video/src/story-template/`

## 3) 关键流程

### 流程 A：标准闭环
1. `runRenderStoryCommand` 解析 CLI 参数并创建 agent client
2. `createStoryVideoFlow` 收集 prompts 并调用 `runStoryWorkflow`
3. `runStoryWorkflow` 依次执行 4 个 stage：
  - collect images
  - generate script
  - render loop
  - publish
4. 返回 `RunSummary` 并打印核心产物路径

### 流程 B：渲染失败恢复
1. `render.stage` 中失败会写入 `error.log` 与 `render-attempts.jsonl`
2. 状态机返回 `select_mode`
3. CLI 继续让用户选择 `template/ai_code/exit`

## 4) 依赖边界

允许依赖方向：
- `story-console` -> `story-pipeline`（仅通过 `story-pipeline/src/index.ts`）
- `story-pipeline` -> `story-video`（当前模板入口路径）

禁止方向：
- `story-pipeline` -> `story-console`
- `story-console` 深层依赖 `story-pipeline/src/domains/*` 或 `workflow/*`

## 5) 测试结构（重构后）

测试统一放在各包 `tests/` 下，`src/` 不再存放测试。

- `packages/story-pipeline/tests/`
- `packages/story-console/tests/`
- `packages/story-video/tests/`

各包统一通过 `tests/run-tests.mjs` 发现并执行 `*.spec.ts`。

## 6) 已清理的旧结构

- 已删除未使用包装层：`packages/story-console/src/flows/create-story-video/use-create-story-video.ts`
- 已删除 `scripts/run-tests.mjs` 路径，统一迁移到 `tests/run-tests.mjs`
- 已移除 `story-console` 对 `story-pipeline` 深层模块引用，改为门面导出
- 已提取命令层错误映射逻辑到独立模块

## 7) 10 分钟读码路径

1. `packages/story-console/src/index.ts`
2. `packages/story-console/src/commands/render-story.command.ts`
3. `packages/story-console/src/flows/create-story-video/create-story-video.flow.ts`
4. `packages/story-pipeline/src/index.ts`
5. `packages/story-pipeline/src/workflow/start-story-run.ts`
6. `packages/story-pipeline/src/workflow/stages/render.stage.ts`
7. `packages/story-video/src/story-template/StoryComposition.tsx`

## 8) 构建与验证

- 安装：`pnpm install`
- 全量测试：`pnpm -r test`
- 全量构建：`pnpm -r build`
- 启动：`pnpm run start`
- 稳定性：`bash scripts/stability-run.sh scripts/fixtures/photos`
