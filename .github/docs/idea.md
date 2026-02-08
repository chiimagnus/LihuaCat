# 狸花猫 (LihuaCat)

**狸花猫（LihuaCat）产品需求说明（PRD v0.2）**

- **产品定位**
- 本地优先的"图片/视频 → 故事短视频"生成工具
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
- **视频渲染**：Remotion（本地 Node.js 环境），Codex 生成 Remotion 代码 → 本地渲染 MP4
- **视频预处理**：FFmpeg（本地二进制，用于视频输入时抽关键帧、格式转换）
- **TUI 框架**：Ink（React for CLI，与 Remotion / 后续 Tauri GUI 同为 React 生态，心智模型统一）
- **包管理**：pnpm
- **核心思路**：app 是编排器，Codex 是执行引擎，每一步是一个 skill

### 项目结构（pnpm monorepo）

```
lihuacat/
├── packages/
│   ├── core/          # workflow 编排、Codex SDK 调用、JSON schema 定义
│   ├── cli/           # Ink TUI，依赖 core
│   └── remotion/      # Remotion 视频项目模板
├── pnpm-workspace.yaml
└── package.json
```

### 核心依赖

| 包 | 用途 |
| --- | --- |
| `@openai/codex-sdk` | 控制本地 Codex agent（AI 理解、故事生成、代码生成） |
| `remotion`  • `@remotion/cli` | 视频合成与本地渲染 |
| `ink`  • `react` | TUI 交互界面 |
| `fluent-ffmpeg` | FFmpeg 封装，视频预处理 |
| `pnpm` | 包管理 + monorepo workspace |

---

## 核心 Workflow（Skill 链）

整条管线由 app 编排，每一步交给 Codex 执行：

| 步骤 | 名称 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | **输入收集** | 用户操作 | 图片路径列表 / 视频路径 + 风格 + 自定义描述 | TUI 交互引导用户完成 |
| 2 | **图片/视频理解** | 素材文件 + Codex | 每张图/关键帧的内容描述（JSON） | Codex 视觉能力分析素材 |
| 3 | **故事生成** | 内容描述 + 风格 + 自定义描述 | 故事脚本（含每段字幕文本、对应素材、时间分配） | Codex 生成结构化故事脚本 |
| 4 | **Remotion 代码生成** | 故事脚本 + 素材路径 | Remotion 项目代码 | Codex 生成可渲染的 React 代码 |
| 5 | **本地渲染** | Remotion 项目 | MP4 视频文件 | Remotion CLI 本地渲染 |
| 6 | **输出** | MP4 + 故事脚本 | 视频文件路径 + 字幕文本 | TUI 展示结果 |

---

## 用户与场景

- 用户想把生活片段/照片变成一个有故事的竖屏短视频
- 用户希望选择一个故事风格，并能补充少量自定义描述来引导故事

## 用户流程（TUI 首版）

1. 用户通过 Codex CLI 登录 ChatGPT 账号（首次使用，一次性操作）
2. 启动狸花猫 TUI
3. 选择素材：指定图片文件夹路径 / 视频文件路径
4. 选择故事风格：`童话 / 冒险 / 治愈 / 搞笑`
5. 可选：输入自定义补充描述
6. 确认后，TUI 显示 workflow 各步骤进度
7. 生成完成后，输出视频文件路径 + 字幕文本

## 输入与约束（首版硬限制）

- 支持两种输入：`视频` 或 `图片`
- 视频最长：`60 秒`
- 图片最多：`20 张`

## 输出规格（首版）

- 视频方向与尺寸：`竖屏 1080x1920`
- 时长：固定 `30 秒`
- 内容形式：`仅字幕`（没有配音/配乐）
- 故事风格：预设风格 + 自定义补充

## 环境依赖（用户侧）

- macOS
- Node.js ≥ 18（Codex SDK + Remotion 依赖）
- FFmpeg（视频预处理，可通过 Homebrew 安装）
- Codex CLI（已登录 ChatGPT 账号，`npm i -g @openai/codex`）
- 狸花猫 CLI/TUI 工具

---

## 后续迭代（已确认方向）

- **Phase 2**：GUI 壳（Tauri + React），替代 TUI
- **Phase 2**：按图片数量自动计算视频时长（替代固定 30 秒）
- **Phase 2**：加入 AI 配音
- **Phase 2**：加入 AI 配乐
- **Phase 3**：迁移到移动端
- **长期**：如 OpenAI 开放第三方 OAuth，升级为 app 内直接登录 ChatGPT