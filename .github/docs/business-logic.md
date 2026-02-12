# LihuaCat 业务全局地图

## 1) 产品概述

LihuaCat 是一个本地优先的交互式 CLI：把“一个图片文件夹”生成一段“故事短视频”。

- 给谁用：希望把一组照片快速转成可分享短视频的用户
- 核心体验：选择图片目录 → 🐱 Tabby 看图聊天理解你的感受 → 🐆 Ocelot 生成渲染脚本 → 本机渲染出视频
- 输入：一个目录下的若干张图片（仅扫描第一层）
- 输出：本地落盘的一次性产物（视频文件 + 过程日志 + `story-brief.json` + `render-script.json`）

## 2) 核心业务能力清单（Capabilities）

### 能力 A：素材收集与校验
- 用户价值：把“可用素材集”稳定收敛成一个确定的输入集合，避免后续生成与渲染在中途失败
- 触发方式：用户选择/提供图片目录后立即发生
- 输入：目录第一层的图片文件
- 输出：被接受的图片列表，或明确的错误提示
- 关键边界与失败方式（用户视角）：
  - 只扫描第一层（不递归子目录）
  - 仅支持 `jpg/jpeg/png`
  - 最多 20 张
  - 目录中一旦出现不支持的格式（如 `webp/heic/heif/gif/bmp/tiff/avif`）会直接报错

### 能力 B：🐱 Tabby 看图对话（理解与追问）
- 用户价值：把用户“模糊的感受”聊清楚，最终形成用户可确认的“人话总结”
- 触发方式：素材校验通过后开始
- 输入：图片列表 + 用户多轮输入
- 输出：`tabby-conversation.jsonl`（每轮结构化输出）+ 最终确认摘要（confirmed summary）
- 关键边界与失败方式（用户视角）：
  - 每轮提供 2–4 个建议选项，且必须包含一个自由输入入口
  - 信息足够后进入确认页：`确认 / 需要修改`；选择“需要修改”会回到对话继续聊（有上限避免无限循环）

### 能力 C：StoryBrief 生成（叙事资产落盘）
- 用户价值：把对话中分散的信息合成为结构化叙事资产，成为后续脚本与呈现层的稳定输入
- 触发方式：用户在确认页点击“确认”后开始
- 输入：图片列表 + `tabby-conversation.jsonl` + confirmed summary
- 输出：结构化 `story-brief.json`
- 失败方式：生成失败时报错退出，并在产物目录中留下可用于排查的日志文件（含 `error.log`）

### 能力 D：🐆 Ocelot 脚本生成（RenderScript）
- 用户价值：把叙事资产转换为“场景化的渲染指令”，让呈现层确定性出片
- 触发方式：StoryBrief 生成后开始
- 输入：`story-brief.json` + 图片列表
- 输出：结构化 `render-script.json`（并落盘 `ocelot-input.json` / `ocelot-output.json` / `ocelot-prompt.log` 供调试）
- 失败方式：生成失败时报错退出，并在产物目录中留下可用于排查的日志文件（含 `error.log`）

### 能力 E：本地渲染与产物落盘
- 用户价值：在用户机器本地完成渲染，产物可直接拿走分享
- 触发方式：RenderScript 生成后执行（单一路径：template 渲染）
- 输入：`render-script.json` + 图片素材
- 输出：`video.mp4` 与本次运行的日志/中间产物
- 关键边界与失败方式（用户视角）：
  - 依赖可用的 Chromium 内核浏览器环境；若自动探测失败，用户需要显式指定浏览器可执行文件位置

## 3) 核心用户流程（User Journeys）

### 流程 1：标准出片闭环
1. 用户选择一个图片目录
2. 系统校验目录素材并给出明确可用/不可用结论
3. 🐱 Tabby 看图聊天（多轮对话 + 选项 + 自由输入）
4. 确认页：用户确认 / 需要修改
5. 系统生成 `story-brief.json`（叙事资产）
6. 🐆 Ocelot 生成 `render-script.json`（渲染指令）
7. 系统使用 Remotion 在本机渲染 `video.mp4`
8. 产物落盘，用户获得可分享的视频文件

### 流程 2：需要修改（回到对话继续聊）
1. Tabby 进入确认页
2. 用户选择“需要修改”
3. 回到对话继续聊 1–3 轮
4. 再次进入确认页，直到用户确认或达到上限报错退出

### 流程 3：浏览器探测失败时的手动指定
1. 系统提示浏览器启动失败/未找到可用浏览器
2. 用户提供浏览器可执行文件位置
3. 系统使用该浏览器继续完成渲染

## 4) 业务规则与约束（Rules & Constraints）

- 输入目录仅扫描第一层文件，不递归
- 仅支持 `jpg/jpeg/png`，最多 20 张
- 目录内出现任意不支持格式会直接报错（防止“部分可用”导致结果不可预期）
- 渲染路径：单一路径（template），渲染失败即报错退出（不做降级与 fallback）

## 5) 产物与可见结果（Outputs）

默认产物目录：`<inputDir>/lihuacat-output/<runId>/`

常见产物：
- `video.mp4`：最终视频
- `story-brief.json`：叙事资产
- `render-script.json`：渲染指令
- `tabby-conversation.jsonl`：Tabby 多轮对话记录（包含 internalNotes）
- `run.log`：本次运行过程日志
- `error.log`：失败时的错误日志
- `ocelot-input.json` / `ocelot-output.json` / `ocelot-prompt.log`：Ocelot 调试文件

## 6) 术语表（Glossary）

- StoryBrief：叙事资产（用户想表达什么 + 每张照片的情感标注 + 叙事结构）
- RenderScript：渲染指令（场景化：哪张图、配什么字、节奏与转场/镜头）
- runId：一次运行的唯一标识，用于隔离产物目录

## 7) 入口索引（可选）

- `src/index.ts`：CLI 入口与交互起点
- `src/flows/create-story-video/create-story-video.flow.ts`：端到端用户流程编排入口
- `src/pipeline.ts`：对外门面（主流程入口）
- `src/story-template/`：内置模板相关实现
