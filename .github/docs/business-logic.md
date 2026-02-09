# LihuaCat 业务全局地图（单包重构后）

## 1) 产品概述

LihuaCat 是本地优先的「图片 -> 故事短视频」生成工具。核心链路：

1. 收集输入目录图片（仅第一层，`jpg/jpeg/png`，最多 20 张）
2. 调用用户本地 Codex 登录态生成结构化 `story-script`
3. 用户在 `template` 与 `ai_code` 两种渲染模式中选择
4. 本地 Remotion 渲染视频并发布产物

设计目标：
- 可读：编排、领域、模板职责分离
- 可维护：阶段化（stages）与清晰门面
- 可扩展：新增渲染策略通过端口注入，不改主编排骨架

## 2) 模块结构（`src/`）

### CLI 与交互
- 入口：`src/index.ts`
- 命令层：`src/commands/render-story.command.ts`
- 错误映射：`src/commands/render-story.error-mapper.ts`
- 交互流程：`src/flows/create-story-video/create-story-video.flow.ts`

### Pipeline 编排核心
- 对外门面：`src/pipeline.ts`
- 编排入口：`src/workflow/start-story-run.ts`
- 阶段实现：
  - `src/workflow/stages/collect-images.stage.ts`
  - `src/workflow/stages/generate-script.stage.ts`
  - `src/workflow/stages/render.stage.ts`
  - `src/workflow/stages/publish.stage.ts`
- 端口与运行时：
  - `src/workflow/workflow-ports.ts`
  - `src/workflow/workflow-runtime.ts`
  - `src/workflow/workflow-events.ts`

### Template 渲染
- 目录：`src/story-template/`
- 模板渲染域服务：`src/domains/template-render/render-by-template.ts`

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
1. `render.stage` 失败写入 `error.log` 与 `render-attempts.jsonl`
2. 状态机返回 `select_mode`
3. CLI 继续让用户选择 `template/ai_code/exit`

## 4) 依赖边界

允许依赖方向：
- `commands/flows` -> `pipeline.ts`（门面）
- `workflow` -> `domains`
- `domains/template-render` -> `story-template`

禁止方向：
- `workflow/domains` 反向依赖 CLI
- 命令层绕过门面直接深层耦合编排内部细节

## 5) 测试结构

所有测试与测试脚本统一放在 `tests/`，无子目录：
- 单测与集成：`tests/*.spec.ts`
- 测试运行器：`tests/run-tests.mjs`
- 稳定性脚本：`tests/stability-run.sh`
- 示例图片夹具：`tests/fixture-photo-*.jpeg`

## 6) 清理结果（完全重构）

- 已移除 `packages/` 与 workspace 结构
- 已移除根 `scripts/`，脚本与夹具并入 `tests/`
- 已统一入口脚本到根 `package.json`
- 已统一测试运行到 `tests/run-tests.mjs`

## 7) 10 分钟读码路径

1. `src/index.ts`
2. `src/commands/render-story.command.ts`
3. `src/flows/create-story-video/create-story-video.flow.ts`
4. `src/pipeline.ts`
5. `src/workflow/start-story-run.ts`
6. `src/workflow/stages/render.stage.ts`
7. `src/story-template/StoryComposition.tsx`

## 8) 构建与验证

- 安装：`pnpm install`
- 全量测试：`pnpm test`
- 全量构建：`pnpm run build`
- 启动：`pnpm run start`
- 稳定性：`bash tests/stability-run.sh tests`
