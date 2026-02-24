# LihuaCat

[中文](https://github.com/chiimagnus/LihuaCat/blob/main/README.zh.md) | [English](https://github.com/chiimagnus/LihuaCat/blob/main/README.md)

Local-first CLI that turns a folder of images into a short story video. Follow the interactive prompts in your terminal and it renders `video.mp4` locally with Remotion.

Current architecture in one line: `Tabby -> StoryBrief -> Ocelot (Creative Director) -> Kitten/Cub -> Remotion`.

Duration rule: final video length is driven by `musicIntent.durationMs` in `creative-plan.json` (not a fixed 30s).

## Prerequisites

- Node.js >= 20
- A Chromium-based browser (Chrome / Edge / Arc / Brave)
- `fluidsynth` command available in `PATH` (for MIDI -> WAV synthesis)
- A SoundFont (`.sf2`) file; project default recommendation is `SGM-V2.01`

## Audio Setup (Recommended)

Standard SoundFont for this project: `SGM-V2.01.sf2`.

Install `fluidsynth`:

- macOS (Homebrew): `brew install fluid-synth`
- Ubuntu/Debian: `sudo apt install fluidsynth`
- Windows (Chocolatey): `choco install fluidsynth` (or install manually and add it to `PATH`)

Download `SGM-V2.01.sf2` (example path):

```bash
mkdir -p "$HOME/.local/share/soundfonts"
curl -L "https://archive.org/download/SGM-V2.01/SGM-V2.01.sf2" -o "$HOME/.local/share/soundfonts/SGM-V2.01.sf2"
```

Set environment variable:

```bash
export LIHUACAT_SOUNDFONT_PATH="$HOME/.local/share/soundfonts/SGM-V2.01.sf2"
```

Persist it (zsh):

```bash
echo 'export LIHUACAT_SOUNDFONT_PATH="$HOME/.local/share/soundfonts/SGM-V2.01.sf2"' >> ~/.zshrc
source ~/.zshrc
```

Windows PowerShell (example):

```powershell
setx LIHUACAT_SOUNDFONT_PATH "C:\soundfonts\SGM-V2.01.sf2"
```

Quick check:

```bash
fluidsynth --version
```

## Development in this repo

- Use `pnpm` for repository development (`pnpm install`, `pnpm test`, `pnpm run build`).
- `npm`/`yarn` install is blocked by `preinstall` to keep lockfile and dependency resolution consistent.

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
- Tabby chat: select 2–4 suggested options (or “free input”), then confirm / revise

## Common flags (optional)

Use flags to prefill prompts and skip steps:

- `--input <dir>`: image directory (must be a single directory path)
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

Common artifacts:

- `video.mp4`
- `story-brief.json`
- `creative-plan.json`
- `visual-script.json`
- `review-log.json`
- `music-json.json`
- `music.mid`
- `music.wav`
- `render-script.json`
- `tabby-conversation.jsonl`
- `run.log` (and `error.log` on failures)
- `ocelot-input.json`, `ocelot-output.json`, `ocelot-prompt.log` (debug)
- `ocelot-revision-{N}.json` (when creative review rounds occur)
- `stages/round-{N}-kitten-visual-script.json`, `stages/round-{N}-cub-midi-json.json`, `stages/round-{N}-ocelot-review.json` (per-round intermediate artifacts)

## Failure strategy

- Ocelot creative review loop has a max of 3 rounds; if still not approved, it records a warning and continues render with the latest version.
- Cub failure degrades to no-music render and records fallback reason in `review-log.json`.
- If SoundFont/`fluidsynth` is missing, workflow degrades to no-music render and records warning in `run.log`.
- Other FluidSynth synthesis failures still exit the run with an error; `music.mid` is kept for debugging/retry.

## Browser (manual override)

If auto-detection fails, specify a browser executable path:

```bash
lihuacat --input /ABS/PATH/TO/PHOTOS --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## Troubleshooting

- `Source directory does not exist ...`: `--input` must be a directory (not multiple file paths)
- `Unsupported image format ...`: unsupported images exist in the directory
- Browser launch failed: install Chrome/Edge/Arc/Brave, or set `--browser-executable`
- StoryBrief / RenderScript generation failed: check Codex auth/model options, then inspect `error.log`
