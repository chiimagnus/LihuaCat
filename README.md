# LihuaCat（狸花猫）

本地优先的「图片 -> 故事短视频」生成工具。

LihuaCat 在本机完成以下流程：
1. 收集图片素材（`jpg`/`jpeg`/`png`）
2. 使用用户自己的 Codex（ChatGPT 账号）生成结构化故事脚本
3. 让用户二选一：`template` 或 `ai_code`
4. 用 Remotion 在本机渲染 `video.mp4`
5. 输出脚本与阶段日志，便于复盘和重试

## 技术栈

- Node.js（建议 >= 20）
- TypeScript（ESM）
- `@openai/codex-sdk`
- Remotion（`remotion` + `@remotion/bundler` + `@remotion/renderer`）

## 仓库结构

- `src`: 单一源码目录（CLI + pipeline + template）
- `tests`: 所有测试与测试夹具
- `.github/docs`: 业务与架构文档
- `.github/plans`: 实施计划

## 安装

```bash
pnpm install
```

## 全局安装（终端直接运行）

现在已支持把它作为一个全局命令安装（`lihuacat`）。

### 方式 A：本地源码安装（适合你自己机器）

```bash
pnpm install
pnpm run build
pnpm link --global
```

然后就可以直接运行：

```bash
lihuacat --input /ABS/PATH/TO/PHOTOS
```

### 方式 B：打包成 tgz 再安装（便于分发给同事）

```bash
pnpm pack
pnpm add -g ./lihuacat-*.tgz
```

### 方式 C：发布到 npm 后安装（适合公开分发）

发布到 npm 后，用户可执行：

```bash
npm i -g @chiimagnus/lihuacat
# 或
pnpm add -g @chiimagnus/lihuacat
```

### 发布到 npm（维护者）

首次发布：

```bash
pnpm install
pnpm run build
pnpm login
pnpm publish
```

后续发版本：

```bash
pnpm version patch
pnpm publish
```

如果你机器上 `npm` 报过 cache 权限问题（`EPERM ... ~/.npm/_cacache`），优先用 `pnpm publish`；或者按 npm 报错提示修复本机 `~/.npm` 权限。

## 常用命令

- 全量测试：`pnpm test`
- 全量构建：`pnpm run build`
- 启动主流程：`pnpm run start`
- 开发态 CLI：`pnpm run dev --`

## 最小可运行示例

```bash
pnpm run dev -- --input /ABS/PATH/TO/PHOTOS
```

未通过参数提供时，CLI 会按顺序询问：
1. 图片目录路径
2. 风格 preset（方向键选择，支持 custom）
3. 可选补充描述
4. 渲染模式选择（方向键：`template` / `ai_code` / `exit`）

CLI 仅支持交互式 TTY 终端；在非交互环境（如管道、重定向、CI 非 TTY）会直接报错退出。

## CLI 参数

- `--input <dir>`: 图片目录（必须是单个目录路径）
- `--style <preset>`: 风格 preset
- `--prompt <text>`: 补充描述
- `--mode <template|ai_code>`: 预设首轮渲染模式（跳过该步选择）
- `--mode-sequence <m1,m2,...>`: 预设多轮模式序列（用于失败重试回合）
- `--browser-executable <path>`: 指定浏览器可执行文件路径
- `--model <name>`: 覆盖 Codex 模型名
- `--model-reasoning-effort <minimal|low|medium|high|xhigh>`: 覆盖推理强度

当前默认（不传时）：
- model: `gpt-5.1-codex-mini`
- reasoning effort: `medium`

CLI 在真实模式下会显示模型信息与阶段进度（spinner + 成功/失败确认行）。

## 输入规则与限制

- 仅支持目录第一层文件，不递归子目录
- 仅支持 `jpg/jpeg/png`
- 最大 20 张
- 如果目录中出现 `webp/heic/...` 等已知但不支持的格式，会直接报错

## 输出目录与产物

默认输出到：
`<inputDir>/lihuacat-output/<runId>/`

关键产物：
- `video.mp4`
- `story-script.json`
- `run.log`
- `error.log`（仅失败时）
- `generated-remotion/`（`ai_code` 模式）
- `stages/run-context.json`
- `stages/material-intake.json`
- `stages/story-script-generated.json`
- `stages/progress-events.jsonl`
- `stages/render-attempts.jsonl`

## 浏览器要求

Remotion 渲染需要 Chromium 内核浏览器。默认自动探测：
- Google Chrome
- Microsoft Edge
- Arc
- Brave

也可显式指定：

```bash
pnpm run dev -- --input tests --mode template --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## 故障排查

- 报错 `Source directory does not exist ...`：`--input` 必须是目录，不是多个文件路径
- 报错 `Unsupported image format ...`：目录中有不支持格式图片
- 报错浏览器启动失败：安装 Chrome/Edge/Arc/Brave 或使用 `--browser-executable`
- 报错脚本生成失败：检查 Codex 登录状态与模型参数，查看 `error.log`

## 安全说明

- 不要提交 `~/.codex/auth.json` 或任何凭证
- `lihuacat-output/` 是运行产物，保持在 `.gitignore`
