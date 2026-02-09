# 狸花猫 (LihuaCat)

**狸花猫（LihuaCat）产品需求说明（PRD v0.2）**

- **产品定位**
- 本地优先的"图片 → 故事短视频"生成工具
- 用户上传一段视频或一组图片，AI 自动编排成一个带字幕的故事短视频
- **开发者零运维**：AI 算力由用户自己的 ChatGPT 账号承担，视频渲染在用户本地完成
- **核心理念**
- **本地优先**：所有处理在用户本地完成，不依赖开发者提供的后端服务
- **用户自带 AI**：通过用户自己的 ChatGPT 账号（Codex）驱动所有 AI 能力
- **Workflow 即产品**：app 本质上是一条 skill 链的编排器，UI 只是 workflow 的皮
- **目标（Goals）**
- 让用户用最少操作完成：素材输入 → 故事生成 → 成片输出
- 首版先把"可稳定跑通的闭环 workflow"做好，后续再加配音/配乐与更智能的时长策略
- **非目标（Non-goals，首版不做）**
- 首版不做 AI 配音
- 首版不做 AI 配乐
- 首版不做自动时长（按素材数量动态长度）
- 首版不做 Web 端
- 首版不做移动端
- 首版不做 GUI（先用 TUI 跑通 workflow）

---

## 技术架构

- **平台**：macOS，首版为 TUI（终端交互界面）+ CLI 工具，后续迁移 GUI（Tauri + React）再到移动端
- **语言**：TypeScript
- **AI 引擎**：通过 `@openai/codex-sdk`（官方 SDK）programmatically 控制本地 Codex agent
    - 认证：复用 Codex CLI 的 ChatGPT 登录凭证（`~/.codex/auth.json`）
    - 用户需先通过 Codex CLI 登录一次 ChatGPT 账号
    - 后续：如 OpenAI 开放第三方 OAuth（"Sign in with ChatGPT"），可升级为 app 内直接登录
- **视频渲染**：Remotion（本地 Node.js 环境），支持模板模式与 AI 代码模式真实渲染 MP4
- **TUI 交互**：Node.js `readline/promises`（问答式 CLI）
- **包管理**：pnpm
- **核心思路**：app 是编排器，Codex 是执行引擎，每一步是一个 skill

### 项目结构（pnpm monorepo）

```
lihuacat/
├── packages/
│   ├── story-pipeline/  # workflow 编排、Codex SDK 调用、业务域逻辑
│   ├── story-console/   # 问答式 CLI/TUI 入口
│   └── story-video/     # Remotion 模板与组件
├── pnpm-workspace.yaml
└── package.json
```

### 核心依赖

| 包 | 用途 |
| --- | --- |
| `@openai/codex-sdk` | 控制本地 Codex agent（故事脚本生成） |
| `remotion` | Remotion 组件与 Composition 定义 |
| `@remotion/renderer` • `@remotion/bundler` | Node 侧真实渲染与打包 |
| `pnpm` | 包管理 + monorepo workspace |

---

## 核心 Workflow（Skill 链）

整条管线由 app 编排，每一步交给 Codex 执行：

| 步骤 | 名称 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | **输入收集** | 用户操作 | 图片目录 + 风格 + 自定义描述 | 问答式 CLI 引导用户完成 |
| 2 | **故事生成** | 图片路径 + 风格 + 自定义描述 | `story-script.json` | Codex 生成结构化脚本并校验 |
| 3 | **渲染模式选择** | 用户二选一 | `template` / `ai_code` | 每次渲染前都需要重新选择 |
| 4 | **模板渲染** | `story-script.json` | MP4 视频文件 | Remotion 模板真实渲染 |
| 5 | **AI 代码渲染** | `story-script.json` | 生成代码 + MP4 | 生成 `generated-remotion/` 并真实渲染 |
| 6 | **输出发布** | 视频 + 脚本 + 日志 | 关键产物路径 | CLI 展示 `video/story-script/run.log/error.log` |

---

## 用户与场景

- 用户想把生活片段/照片变成一个有故事的竖屏短视频
- 用户希望选择一个故事风格，并能补充少量自定义描述来引导故事

## 用户流程（TUI 首版）

1. 用户通过 Codex CLI 登录 ChatGPT 账号（首次使用，一次性操作）
2. 启动狸花猫 TUI
3. 选择素材：指定图片文件夹路径
4. 选择故事风格：`童话 / 冒险 / 治愈 / 搞笑`
5. 可选：输入自定义补充描述
6. 确认后，TUI 显示 workflow 各步骤进度
7. 生成完成后，输出视频文件路径 + 字幕文本

## 输入与约束（首版硬限制）

- 仅支持输入：`图片目录`
- 支持格式：`jpg/jpeg/png`
- 图片最多：`20 张`

## 输出规格（首版）

- 视频方向与尺寸：`竖屏 1080x1920`
- 时长：固定 `30 秒`
- 内容形式：`仅字幕`（没有配音/配乐）
- 故事风格：预设风格 + 自定义补充

## 环境依赖（用户侧）

- macOS
- Node.js ≥ 18（Codex SDK + Remotion 依赖）
- Codex CLI（已登录 ChatGPT 账号，`npm i -g @openai/codex`）
- 狸花猫 CLI/TUI 工具
- 本机 Chromium 浏览器之一（Google Chrome / Microsoft Edge / Arc / Brave），或通过 `--browser-executable` 指定路径

---

## 后续迭代（已确认方向）

- **Phase 2**：GUI 壳（Tauri + React），替代 TUI
- **Phase 2**：按图片数量自动计算视频时长（替代固定 30 秒）
- **Phase 2**：加入 AI 配音
- **Phase 2**：加入 AI 配乐
- **Phase 3**：迁移到移动端
- **长期**：如 OpenAI 开放第三方 OAuth，升级为 app 内直接登录 ChatGPT

---

## 当前实现状态（2026-02-09）

### 已实现（MVP 骨架）

- Monorepo 基础结构：`story-pipeline` / `story-console` / `story-video`
- 图片输入校验：
  - 仅支持 `jpg/jpeg/png`
  - 最大 20 张
  - 检测不支持格式并报错
- `story-script` 校验体系：
  - 结构校验（必填字段、类型）
  - 语义校验（总时长 30 秒、每图至少 1 秒、全量素材覆盖）
- 生成重试策略：
  - 故事脚本生成失败自动重试 2 次（总尝试 3 次）
- 渲染模式编排：
  - 二选一循环状态机（`template` / `ai_code`）
  - AI 代码渲染失败后返回二选一菜单
  - 模板渲染失败后返回二选一菜单
  - 任一模式成功后结束
- 产物发布：
  - 输出 `video.mp4`、`story-script.json`、`run.log`
  - AI 代码模式生成目录：`generated-remotion/`
- CLI 命令（开发态）：
  - `pnpm --filter @lihuacat/story-console dev -- --input <dir> --mode template --mock-agent`
- 一键启动（根脚本）：
  - `pnpm run build` / `npm run build`（先构建再启动主流程）
  - `pnpm run start` / `npm run start`（直接启动主流程）
- 稳定性脚本：
  - `scripts/stability-run.sh`

### 当前约束

- 默认已切换到真实链路：真实 Codex SDK + 真实 Remotion 渲染，不再使用占位渲染。
- `--mock-agent` 仅用于本地测试；默认不启用。
- AI 代码模式失败会输出详细错误并返回模式选择；不自动回退模板模式。
