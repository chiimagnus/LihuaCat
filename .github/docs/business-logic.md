# LihuaCat 业务全局地图

## 1) 产品概述

LihuaCat 是一个本地优先的「图片生成故事短视频」编排器，面向希望把相册素材快速转成竖屏故事视频的用户。核心体验是：给定图片目录后，系统自动生成 `story-script.json`，再由用户在 `template` 与 `ai_code` 两种渲染模式中选择并完成本地渲染。技术栈：TypeScript + pnpm workspace + Codex SDK + Remotion。

产品原则：
- 本地优先：素材、脚本、渲染、产物都在用户本机完成。
- 用户自带 AI：通过用户自己的 Codex 登录态完成脚本生成。
- 编排优先：首版聚焦 workflow 稳定闭环，不追求复杂界面。

目标与非目标（首版）：
- 目标：稳定跑通「素材输入 -> 脚本生成 -> 渲染选择 -> 成片输出」。
- 目标：关键阶段可观测，失败后可复盘与重试。
- 非目标：不做配音、配乐、自动时长、视频输入、GUI/Web/移动端。

## 2) 架构分层

按业务能力分层，而不是按技术类型分层。

- `packages/story-console`
- 职责：CLI/TUI 交互、参数解析、进度与错误展示。
- 关键路径：`packages/story-console/src/commands/render-story.command.ts`

- `packages/story-pipeline`
- 职责：业务编排核心，包含素材 intake、脚本生成、渲染选择状态机、模板渲染、AI 代码渲染、产物发布。
- 关键路径：`packages/story-pipeline/src/workflow/start-story-run.ts`

- `packages/story-video`
- 职责：Remotion 模板组合与视觉实现。
- 关键路径：`packages/story-video/src/story-template/`

依赖方向约束：
- `story-console` -> `story-pipeline`
- `story-pipeline` -> `story-video`（通过 entry path 渲染）
- 禁止 `story-pipeline` 依赖 `story-console`。

## 3) 核心业务流程

### 流程 A：标准图片到视频闭环

1. CLI 收集输入：目录、风格、补充描述、渲染模式。
2. `story-pipeline` 收集素材并校验格式和数量。
3. 调用 Codex 生成结构化脚本并做结构/语义校验，失败重试。
4. 进入渲染模式选择状态机，用户每轮二选一。
5. 渲染成功后发布产物并返回 summary。

关键文件：
- `packages/story-console/src/commands/render-story.command.ts`
- `packages/story-console/src/flows/create-story-video/create-story-video.flow.ts`
- `packages/story-pipeline/src/workflow/start-story-run.ts`
- `packages/story-pipeline/src/domains/material-intake/collect-images.ts`
- `packages/story-pipeline/src/domains/story-script/generate-story-script.ts`
- `packages/story-pipeline/src/domains/render-choice/render-choice-machine.ts`
- `packages/story-pipeline/src/domains/artifact-publish/publish-artifacts.ts`

### 流程 B：渲染失败后的恢复

1. 任一模式渲染失败后，失败原因写入 `error.log` 与 `stages/render-attempts.jsonl`。
2. 状态机回到 `select_mode`，CLI 显示上轮失败原因。
3. 用户继续选择 `template` / `ai_code` 或 `exit`。

关键文件：
- `packages/story-pipeline/src/workflow/start-story-run.ts`
- `packages/story-pipeline/src/domains/render-choice/render-choice-machine.ts`

## 4) 模块详情

### 模块：素材收集（Material Intake）

- 作用：读取输入目录第一层图片，构建素材列表。
- 关键规则：仅支持 `jpg/jpeg/png`；最大 20 张；不递归子目录。
- 文件：
- `packages/story-pipeline/src/domains/material-intake/collect-images.ts`
- `packages/story-pipeline/src/domains/material-intake/material-intake.errors.ts`
- 测试：
- `packages/story-pipeline/src/domains/material-intake/collect-images.spec.ts`

### 模块：故事脚本生成（Story Script）

- 作用：调用 Codex 生成结构化脚本并校验约束。
- 关键规则：固定 30 秒、每素材至少 1 秒、素材必须全覆盖。
- 默认模型：`gpt-5.1-codex-mini`；默认 reasoning：`medium`。
- 文件：
- `packages/story-pipeline/src/domains/story-script/story-agent.client.ts`
- `packages/story-pipeline/src/domains/story-script/generate-story-script.ts`
- `packages/story-pipeline/src/domains/story-script/validate-story-script.ts`
- `packages/story-pipeline/src/domains/story-script/validate-story-script.semantics.ts`
- `packages/story-pipeline/src/contracts/story-script.schema.json`
- 测试：
- `packages/story-pipeline/src/domains/story-script/story-agent.client.spec.ts`
- `packages/story-pipeline/src/domains/story-script/generate-story-script.spec.ts`
- `packages/story-pipeline/src/domains/story-script/validate-story-script.spec.ts`

### 模块：渲染选择状态机（Render Choice）

- 作用：管理 `select_mode -> rendering -> completed` 状态流转。
- 关键规则：失败返回选择态，不自动降级。
- 文件：
- `packages/story-pipeline/src/domains/render-choice/render-choice-machine.ts`
- 测试：
- `packages/story-pipeline/src/domains/render-choice/render-choice-machine.spec.ts`

### 模块：模板渲染（Template Render）

- 作用：使用固定模板将脚本渲染为视频。
- 关键实现：渲染前将本地图片拷贝到 `remotion-public/lihuacat-assets`，模板中通过 `staticFile()` 加载，规避 `file://` 与跨源问题。
- 文件：
- `packages/story-pipeline/src/domains/template-render/render-by-template.ts`
- `packages/story-pipeline/src/domains/template-render/remotion-renderer.ts`
- `packages/story-pipeline/src/domains/template-render/browser-locator.ts`
- `packages/story-pipeline/src/domains/render-assets/stage-remotion-assets.ts`
- `packages/story-video/src/story-template/StoryComposition.tsx`
- 测试：
- `packages/story-pipeline/src/domains/template-render/render-by-template.spec.ts`
- `packages/story-pipeline/src/domains/render-assets/stage-remotion-assets.spec.ts`
- `packages/story-video/src/story-template/StoryComposition.spec.ts`

### 模块：AI 代码渲染（AI Code Render）

- 作用：根据脚本生成 `generated-remotion/Scene.tsx` 与 entry，再编译渲染。
- 关键实现：与模板渲染共享静态资源 staging 逻辑。
- 文件：
- `packages/story-pipeline/src/domains/ai-code-render/render-by-ai-code.ts`
- `packages/story-pipeline/src/domains/ai-code-render/generate-remotion-scene.ts`
- 测试：
- `packages/story-pipeline/src/domains/ai-code-render/render-by-ai-code.spec.ts`

### 模块：工作流编排与产物发布

- 作用：串联全流程、记录进度事件、落盘阶段产物、输出 summary。
- 关键产物：`story-script.json`、`run.log`、`error.log`、`stages/*.json*`。
- 文件：
- `packages/story-pipeline/src/workflow/start-story-run.ts`
- `packages/story-pipeline/src/domains/artifact-publish/publish-artifacts.ts`
- `packages/story-pipeline/src/domains/artifact-publish/build-run-summary.ts`
- 测试：
- `packages/story-pipeline/src/workflow/start-story-run.e2e.spec.ts`
- `packages/story-pipeline/src/domains/artifact-publish/publish-artifacts.spec.ts`

## 5) 当前状态与待办

### 已完成

- [x] 真实 Codex + 真实 Remotion 链路跑通。
- [x] CLI 进度反馈与失败原因展示。
- [x] 模型信息可见（启动时显示 model 与 reasoning）。
- [x] 图片渲染链路改为 staging + `staticFile()`，修复本地资源加载问题。
- [x] 阶段产物即时落盘，失败时也可复盘。

### 进行中

- [ ] 文档体系补齐（README、business-logic、需求文档同步）。

### 已知问题

- 仅扫描输入目录第一层，不支持递归子目录。
- 输入仅支持 `jpg/jpeg/png`，其余格式直接报错。
- 根脚本 `pnpm run build` 目前会在构建后直接进入交互式 CLI，不是纯构建语义。

### 下一步计划（按优先级）

- P1：补一个“直接用已有 `story-script.json` 渲染”的正式 CLI 子命令。
- P1：增加更细粒度的渲染阶段进度（bundle/select composition/render 百分比）。
- P2：评估是否支持可选递归扫描（保留默认单层行为）。
- P2：在不做强制预处理前提下，探索扩展格式支持策略。

## 6) 设计决策记录

### 决策 1：首版只支持图片目录，不支持视频输入

- 背景：先稳定跑通图片故事闭环。
- 选项：图片+视频并行支持；仅图片。
- 决定：仅图片。
- 原因：压缩复杂度，避免视频解码/时长分段带来的额外不稳定性。

### 决策 2：渲染失败后不自动回退模板

- 背景：用户要求失败原因透明、可控重试。
- 选项：失败自动回退模板；失败回到二选一。
- 决定：回到二选一。
- 原因：避免静默策略切换，便于定位真实失败点。

### 决策 3：本地图片采用 staging + staticFile

- 背景：`file://` 在 Chromium 渲染环境下会出现资源拦截和解码失败。
- 选项：继续使用 `file://`；改为 `public` 静态资源。
- 决定：改为 staging 到 `remotion-public` 并使用 `staticFile()`。
- 原因：与 Remotion 推荐模式一致，稳定性更高。

### 决策 4：默认模型配置固定在项目内

- 背景：用户希望项目行为不受个人全局配置漂移影响。
- 选项：完全继承全局 Codex 配置；项目内设默认并允许覆盖。
- 决定：项目内默认 `gpt-5.1-codex-mini + medium`，CLI 允许覆盖。
- 原因：默认可预测，同时保留灵活性。

## 7) 构建与测试

- Install: `pnpm install`
- Build: `pnpm -r build`
- Start: `pnpm run start`
- Full Test: `pnpm -r test`
- Stability: `bash scripts/stability-run.sh scripts/fixtures/photos`
