# LihuaCat（狸花猫）

本地优先的「图片 → 故事短视频」生成工具（CLI）。你在终端里跟着提示选项走，它会用 Remotion 在本机渲染出 `video.mp4`。

## 开始之前

你需要：
- Node.js >= 20
- 一款 Chromium 内核浏览器（Chrome / Edge / Arc / Brave 任一）

## 你会怎么使用它（交互式）

1) 先把它安装到本机（包名：`@chiimagnus/lihuacat`，安装后命令是 `lihuacat`）：

```bash
npm i -g @chiimagnus/lihuacat
# 或
pnpm add -g @chiimagnus/lihuacat
```

2) 然后在终端里启动它，并把图片目录告诉它：

```bash
lihuacat
```

3) 接下来你会看到一连串交互问题（方向键选择 / 回车确认），通常包括：
- 图片目录路径（如果没传 `--input`）
- 风格 preset（可选 custom）
- 可选补充描述（prompt）
- 渲染模式选择：`template` / `ai_code` / `exit`

## 常用参数（可选）

当你想跳过某一步交互时，可以用参数预填：
- `--input <dir>`：图片目录（必须是单个目录路径）
- `--style <preset>`：风格 preset
- `--prompt <text>`：补充描述
- `--mode <template|ai_code>`：预设首轮渲染模式
- `--mode-sequence <m1,m2,...>`：预设多轮模式序列（失败重试回合）
- `--browser-executable <path>`：指定浏览器可执行文件路径
- `--model <name>`：覆盖 Codex 模型名
- `--model-reasoning-effort <minimal|low|medium|high|xhigh>`：覆盖推理强度

默认（不传时）：
- model：`gpt-5.1-codex-mini`
- reasoning effort：`medium`

## 输入规则

- 仅扫描 `--input` 目录第一层文件，不递归子目录
- 仅支持 `jpg/jpeg/png`
- 最大 20 张
- 若目录中出现 `webp/heic/heif/gif/bmp/tiff/avif` 会作为不支持格式报错

## 输出在哪里

默认输出到：`<inputDir>/lihuacat-output/<runId>/`

常用产物：`video.mp4`、`story-script.json`、`run.log`（失败时还有 `error.log`）。

## 浏览器（你也可以手动指定）

当自动探测失败时，你可以把浏览器可执行文件路径交给它：

```bash
lihuacat --input /ABS/PATH/TO/PHOTOS --mode template --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## 常见问题

- `Source directory does not exist ...`：`--input` 必须是目录，不是多个文件路径
- `Unsupported image format ...`：目录里存在不支持格式图片
- 浏览器启动失败：先安装 Chrome/Edge/Arc/Brave，或用 `--browser-executable` 指定路径
- 脚本生成失败：检查 Codex 登录状态与模型参数，然后看 `error.log`
