# LihuaCat

[中文](README.zh.md) | [English](README.md)

本地优先的 CLI 工具：把一个图片文件夹生成一段“故事短视频”。你只需要在终端里按交互提示操作，它会使用 Remotion 在本机渲染出 `video.mp4`。

> 说明：当前 CLI 交互文案为英文（项目整体以英文为主），本文件仅提供中文使用说明。

## 环境要求

- Node.js >= 20
- Chromium 内核浏览器（Chrome / Edge / Arc / Brave）

## 仓库开发说明

- 仓库开发统一使用 `pnpm`（如：`pnpm install`、`pnpm test`、`pnpm run build`）。
- 为避免锁文件与依赖解析不一致，`preinstall` 会阻止使用 `npm`/`yarn` 安装依赖。

## 基础用法（交互式）

1) 全局安装（包名：`@chiimagnus/lihuacat`，命令：`lihuacat`）：

```bash
npm i -g @chiimagnus/lihuacat
# 或
pnpm add -g @chiimagnus/lihuacat
```

2) 启动：

```bash
lihuacat
```

3) 接下来会进入一系列交互问题（方向键选择 + 回车确认），通常包括：

- 图片素材目录（如果没传 `--input`）
- Tabby 聊天：每轮 2–4 个建议选项（含自由输入），最后确认 / 需要修改

## 常用参数（可选）

你可以用参数预填并跳过部分交互步骤：

- `--input <dir>`：图片目录（必须是“单个目录路径”）
- `--browser-executable <path>`：指定浏览器可执行文件路径
- `--model <name>`：覆盖 Codex 模型名
- `--model-reasoning-effort <minimal|low|medium|high|xhigh>`：覆盖推理强度
- `--lynx-review`：开启 Lynx 审稿 + 脚本修改循环（默认关闭）

默认值（不传时）：

- model：`gpt-5.1-codex-mini`
- reasoning effort：`medium`

## 输入规则

- 只扫描 `--input` 目录的第一层文件（不递归子目录）
- 只支持 `jpg/jpeg/png`
- 最多 20 张
- 若目录中出现 `webp/heic/heif/gif/bmp/tiff/avif`，会作为“不支持格式”报错

## 输出位置

默认输出到：`<inputDir>/lihuacat-output/<runId>/`

常见产物：

- `video.mp4`
- `story-brief.json`
- `render-script.json`
- `tabby-conversation.jsonl`
- `run.log`（失败时还有 `error.log`）
- `ocelot-input.json`、`ocelot-output.json`、`ocelot-prompt.log`（调试用）
- （当启用 `--lynx-review`）`lynx-review-{N}.json`、`ocelot-revision-{N}.json`、`lynx-prompt-{N}.log`

## 浏览器（手动指定）

当自动探测失败时，可以手动指定浏览器可执行文件路径：

```bash
lihuacat --input /ABS/PATH/TO/PHOTOS --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## 常见问题排查

- `Source directory does not exist ...`：`--input` 必须是目录（不能传多个文件路径）
- `Unsupported image format ...`：目录里存在不支持的图片格式
- 浏览器启动失败：先安装 Chrome/Edge/Arc/Brave，或用 `--browser-executable` 指定路径
- StoryBrief / RenderScript 生成失败：检查 Codex 登录/模型参数，然后查看 `error.log`
