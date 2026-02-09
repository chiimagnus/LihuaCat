# LihuaCat（狸花猫）

本地优先的「图片 -> 故事短视频」生成工具。

LihuaCat 会在本机完成以下流程：
1. 收集图片素材（`jpg`/`jpeg`/`png`）
2. 使用用户自己的 Codex（ChatGPT 账号）生成结构化故事脚本
3. 让用户每次都二选一：`template` 或 `ai_code`
4. 用 Remotion 在本机渲染 `video.mp4`
5. 输出脚本与分阶段日志，便于复盘和重试

## 技术栈

- Node.js（建议 >= 20）
- TypeScript（ESM）
- `pnpm workspace`
- `@openai/codex-sdk`
- Remotion（`remotion` + `@remotion/bundler` + `@remotion/renderer`）

## 仓库结构

- `packages/story-pipeline`: 业务编排核心（素材收集、脚本生成、渲染选择、产物发布）
- `packages/story-console`: CLI/TUI 入口
- `packages/story-video`: Remotion 模板与组合
- `scripts`: 稳定性脚本与示例素材
- `.github/docs`: 需求与业务文档

## 安装

```bash
pnpm install
```

## 常用命令

- 全量测试：`pnpm -r test`
- 全量构建：`pnpm -r build`
- 一键构建并启动：`pnpm run build` 或 `npm run build`
- 仅启动主流程：`pnpm run start` 或 `npm run start`
- 开发态 CLI：`pnpm --filter @lihuacat/story-console dev --`

## 最小可运行示例

```bash
pnpm --filter @lihuacat/story-console dev -- --input /ABS/PATH/TO/PHOTOS
```

运行后会按顺序询问：
1. 图片目录路径
2. 风格 preset
3. 可选补充描述
4. 渲染模式选择（`template` / `ai_code` / `exit`）

## CLI 参数

- `--input <dir>`: 图片目录（必须是单个目录路径）
- `--style <preset>`: 风格 preset
- `--prompt <text>`: 补充描述
- `--mode <template|ai_code>`: 预设首轮渲染模式
- `--mode-sequence <m1,m2,...>`: 预设多轮模式序列
- `--browser-executable <path>`: 指定浏览器可执行文件路径
- `--mock-agent`: 使用 mock 脚本生成（不调用 Codex）
- `--model <name>`: 覆盖 Codex 模型名
- `--model-reasoning-effort <minimal|low|medium|high|xhigh>`: 覆盖推理强度

当前项目默认（不传时）为：
- model: `gpt-5.1-codex-mini`
- reasoning effort: `medium`

CLI 在真实模式下会打印：
`[info] Using Codex model: ... (reasoning: ...)`

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
pnpm --filter @lihuacat/story-console dev -- --input scripts/fixtures/photos --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## 稳定性测试

```bash
bash scripts/stability-run.sh scripts/fixtures/photos
```

可通过环境变量指定次数和浏览器：
- `LIHUACAT_STABILITY_RUNS`
- `LIHUACAT_BROWSER_EXECUTABLE`

## 故障排查

- 报错 `Source directory does not exist ...`：`--input` 必须是一个目录，不是多个文件路径
- 报错 `Unsupported image format ...`：目录中有非 `jpg/jpeg/png` 图片
- 报错浏览器启动失败：安装 Chrome/Edge/Arc/Brave 或使用 `--browser-executable`
- 报错脚本生成失败：检查 Codex 登录状态与模型参数，查看 `error.log`

## 安全说明

- 不要提交 `~/.codex/auth.json` 或任何凭证
- `lihuacat-output/` 是运行产物，保持在 `.gitignore`
