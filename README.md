# LihuaCat

[中文](README.zh.md) | [English](README.md)

Local-first CLI that turns a folder of images into a short story video. Follow the interactive prompts in your terminal and it renders `video.mp4` locally with Remotion.

## Prerequisites

- Node.js >= 20
- A Chromium-based browser (Chrome / Edge / Arc / Brave)

## Basic usage (interactive)

1) Install it globally (package: `@chiimagnus/lihuacat`, command: `lihuacat`):

```bash
npm i -g @chiimagnus/lihuacat
# or
pnpm add -g @chiimagnus/lihuacat
```

2) Run it:

```bash
lihuacat
```

3) You’ll be guided through a few prompts (arrow keys + Enter), usually including:

- Source image directory (if you didn’t pass `--input`)
- Style preset (optionally `custom`)
- Optional extra description (prompt)
- Render mode: `template` / `ai_code` / `exit`

## Common flags (optional)

Use flags to prefill prompts and skip steps:

- `--input <dir>`: image directory (must be a single directory path)
- `--style <preset>`: style preset
- `--prompt <text>`: extra description
- `--mode <template|ai_code>`: initial render mode
- `--mode-sequence <m1,m2,...>`: preset multi-round mode sequence (for retry loops)
- `--browser-executable <path>`: explicit browser executable path
- `--model <name>`: override Codex model name
- `--model-reasoning-effort <minimal|low|medium|high|xhigh>`: override reasoning effort

Defaults (when not provided):

- model: `gpt-5.1-codex-mini`
- reasoning effort: `medium`

## Input rules

- Only scans the first level of `--input` (non-recursive)
- Only supports `jpg/jpeg/png`
- Maximum 20 images
- If the directory contains `webp/heic/heif/gif/bmp/tiff/avif`, it errors as “unsupported format”

## Output location

By default, outputs to: `<inputDir>/lihuacat-output/<runId>/`

Common artifacts: `video.mp4`, `story-script.json`, `run.log` (and `error.log` on failures).

## Browser (manual override)

If auto-detection fails, specify a browser executable path:

```bash
lihuacat --input /ABS/PATH/TO/PHOTOS --mode template --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## Troubleshooting

- `Source directory does not exist ...`: `--input` must be a directory (not multiple file paths)
- `Unsupported image format ...`: unsupported images exist in the directory
- Browser launch failed: install Chrome/Edge/Arc/Brave, or set `--browser-executable`
- Script generation failed: check Codex auth/model options, then inspect `error.log`

