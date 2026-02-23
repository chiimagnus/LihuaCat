# LihuaCat 业务全局地图

## 1) 产品概述

LihuaCat 是一个本地优先的交互式 CLI：把“用户的一组真实照片 + 用户当下真实的感受”转化成“可分享的叙事体验”（当前主要以短视频呈现）。

- 给谁用：有一组“对自己很重要”的照片，想把“那天的感觉”表达清楚并分享给特定的人（或留给自己）的用户
- 核心体验：选图片目录 → 🐱 Tabby 看图对话把感受聊清楚 → 用户确认 → 🐆 Ocelot 生成 CreativePlan 并驱动 Kitten/Cub 执行与审稿 → 合并 RenderScript → 本机渲染出作品
- 输入：一个目录下的若干张图片（仅扫描第一层）
- 输出：本地落盘的一次性产物（最终作品 + 可审阅的叙事资产与过程记录）

## 2) 核心执行单元（Agents / Subagents / Tools）

> 这里按“谁在执行”来陈列（agents / subagents / tools），而不是按传统“能力模块”拆分。

### Agents（面向意图的决策与生成）

#### 🐱 Tabby（对话导演）

- 用户价值：把用户“模糊的感受”聊清楚，形成用户可确认的表达意图
- 触发方式：素材通过校验后开始
- 输入：图片列表 + 用户多轮输入
- 输出：对话记录 + 最终确认摘要（用户可读、可确认）
- 关键边界与失败方式（用户视角）：
  - 每轮提供“建议选项 + 自由输入”两种表达路径，降低用户表达门槛
  - 信息足够后进入确认页：用户可以“确认 / 需要修改”；选择“需要修改”会回到对话继续聊（有上限避免无限循环）

#### 🐆 Ocelot（创意总监）

- 用户价值：把叙事资产升级为“可执行创意方案”，统一把控视觉与音乐的一致性和忠实度
- 触发方式：StoryBrief 生成后开始
- 输入：StoryBrief + 图片列表 + Kitten/Cub 的分工产出
- 输出：CreativePlan + 审稿意见（通过/不通过 + 可执行修改建议）+ 最终可渲染脚本
- 关键边界与失败方式（用户视角）：
  - 审稿循环最多 3 轮；超限会记录 warning 并继续渲染最新版本
  - 若 CreativePlan 链路不可用，可退回兼容的 RenderScript 直出链路

### Subagents（把某一步做成稳定的子任务）

#### StoryBrief 生成器（叙事资产整理）

- 用户价值：把对话中分散的信息合成为结构化叙事资产，作为后续脚本/呈现层的稳定输入
- 触发方式：用户在确认页点击“确认”后开始
- 输入：图片列表 + 对话记录 + confirmed summary
- 输出：StoryBrief（叙事资产）
- 失败方式：生成失败时报错退出，并留下可定位原因的错误信息

#### 🐾 Kitten（视觉脚本）

- 用户价值：把 CreativePlan 的视觉方向落地成可渲染的 VisualScript
- 输入：CreativePlan + 图片列表 + 可选 revision notes
- 输出：VisualScript（分镜/字幕/时长/转场）

#### 🐾 Cub（音乐）

- 用户价值：把 CreativePlan 的音乐意图落地成结构化配乐资产
- 输入：CreativePlan + 可选 revision notes
- 输出：MIDI JSON（固定轨道合同），后续进入确定性工具链生成 `music.mid` / `music.wav`

### Tools（确定性的本地能力）

#### 素材收集与校验工具

- 用户价值：把“可用素材集”稳定收敛成确定输入，避免中途失败
- 触发方式：用户选择/提供图片目录后立即发生
- 输入：目录第一层的图片文件
- 输出：被接受的图片列表，或明确的错误提示
- 关键边界与失败方式（用户视角）：
  - 只扫描第一层（不递归子目录）
  - 仅支持 `jpg/jpeg/png`
  - 最多 20 张
  - 目录中一旦出现不支持的格式（如 `webp/heic/heif/gif/bmp/tiff/avif`）会直接报错

#### 本地渲染工具

- 用户价值：在用户机器本地完成渲染，产物可直接拿走分享
- 触发方式：RenderScript（含可选音轨引用）生成后执行
- 输入：RenderScript + 图片素材 + 可选音频素材
- 输出：最终作品文件（当前为视频）与本次运行的必要过程记录
- 关键边界与失败方式（用户视角）：
  - 依赖可用的浏览器运行环境；若自动探测失败，用户需要手动指定浏览器可执行文件位置

#### 音频工具链（MIDI JSON -> MID -> WAV）

- 用户价值：把音乐意图稳定转换为本地可合成、可渲染的音轨
- 触发方式：Cub 产出 MIDI JSON 后执行
- 输入：MIDI JSON + SoundFont 路径
- 输出：`music.mid` 与 `music.wav`
- 关键边界与失败方式（用户视角）：
  - Cub 失败时可降级为无配乐渲染，并写入 warning
  - FluidSynth 失败时直接报错退出，并保留已写入的 `music.mid`

## 3) 核心用户流程（User Journeys）

### 流程 1：标准出片闭环

1. 用户选择一个图片目录
2. 系统校验目录素材并给出明确可用/不可用结论
3. 🐱 Tabby 看图聊天（多轮对话 + 选项 + 自由输入）
4. 确认页：用户确认 / 需要修改
5. 系统生成叙事资产（StoryBrief）
6. 🐆 Ocelot 生成 CreativePlan 并调度 🐾 Kitten / 🐾 Cub
7. Ocelot 审稿并驱动改稿（最多 3 轮）
8. 系统合并产物为 RenderScript（可含音轨），并完成本地渲染
9. 产物落盘，用户获得可分享的作品文件与可审阅资产

### 流程 2：需要修改（回到对话继续聊）

1. Tabby 进入确认页
2. 用户选择“需要修改”
3. 回到对话继续聊（有限轮次，避免无限循环）
4. 再次进入确认页，直到用户确认或达到上限后退出

### 流程 3：浏览器探测失败时的手动指定

1. 系统提示浏览器启动失败/未找到可用浏览器
2. 用户提供浏览器可执行文件位置
3. 系统使用该浏览器继续完成渲染

## 4) 业务流程图（Mermaid）

```mermaid
flowchart TD
  Start(["▶ 用户启动 CLI"])
  Done(["✅ 产物落盘"])

  subgraph input ["📂 素材输入"]
    direction TB
    PickDir["选择图片目录"]
    Intake["素材收集与校验<br/>仅第一层 · jpg/jpeg/png · ≤20 张"]
  end

  subgraph ai ["🧠 理解与生成"]
    direction TB
    Tabby["🐱 Tabby 看图对话<br/>建议选项 + 自由输入"]
    Confirm{"确认 / 需要修改"}
    Brief["生成叙事资产（StoryBrief）"]
    OcelotPlan["🐆 Ocelot 生成 CreativePlan"]
    Kitten["🐾 Kitten 生成 VisualScript"]
    Cub["🐾 Cub 生成 MIDI JSON"]
    OcelotReview{"🐆 Ocelot 审稿通过?"}
    Merge["合并为 RenderScript（含可选音轨）"]
  end

  subgraph render ["🎬 本地渲染输出"]
    direction TB
    Audio["MIDI JSON -> music.mid -> music.wav"]
    Render["本机渲染最终作品"]
    NeedBrowser["提示指定浏览器路径"]
  end

  subgraph fail ["❌ 异常退出"]
    direction TB
    FailInput["报错：目录/格式/数量"]
    FailAI["报错：生成失败（可定位原因）"]
    FailRender["报错：渲染失败（可定位原因）"]
  end

  Start --> PickDir
  PickDir --> Intake
  Intake -- "✓ 通过" --> Tabby
  Intake -. "✗ 不通过" .-> FailInput

  Tabby --> Confirm
  Confirm -- "需要修改" --> Tabby
  Confirm -- "确认 ✓" --> Brief
  Brief --> OcelotPlan
  OcelotPlan --> Kitten
  OcelotPlan --> Cub
  Kitten --> OcelotReview
  Cub --> Audio
  Audio --> OcelotReview
  OcelotReview -- "否（<=3轮）" --> Kitten
  OcelotReview -- "是 / 超限继续" --> Merge
  Merge --> Render
  Render --> Done

  Tabby -. "鉴权/模型失败" .-> FailAI
  Brief -. "生成失败" .-> FailAI
  OcelotPlan -. "生成失败" .-> FailAI
  Audio -. "FluidSynth 失败" .-> FailAI

  Render -. "浏览器不可用" .-> NeedBrowser
  NeedBrowser -- "指定路径后重试" --> Render
  Render -. "渲染失败" .-> FailRender
```

## 5) 业务规则与约束（Rules & Constraints）

- 输入目录仅扫描第一层文件，不递归
- 仅支持 `jpg/jpeg/png`，最多 20 张
- 目录内出现任意不支持格式会直接报错（防止“部分可用”导致结果不可预期）
- Ocelot 创意审稿循环最多 3 轮；超限会记录 warning 并继续渲染
- Cub 失败可降级为无配乐渲染（不阻塞成片）
- FluidSynth 合成失败会中断流程（保留 `music.mid` 以便排查）
- 渲染失败会直接报错退出（不做“换一种模式自动兜底”的降级）
- 交互形态为 TUI，必须在 TTY 终端中运行；非 TTY 环境会直接报错退出
- 本地优先：不把用户照片/对话上传到云端作为产品默认路径

## 6) 产物与可见结果（Outputs）

默认产物目录：输入目录下的 `lihuacat-output/<runId>/`

常见产物：

- 最终作品文件（当前主要为视频）
- StoryBrief（叙事资产，便于人类审阅“是否表达准确”）
- CreativePlan / VisualScript / ReviewLog（创意分工与审稿轨迹）
- MIDI JSON / `music.mid` / `music.wav`（音乐资产与合成结果）
- RenderScript（渲染脚本，作为呈现层输入合同）
- 对话记录与运行日志（便于复盘与定位问题）
- 错误信息（失败时可定位原因）

## 7) 术语表（Glossary）

- StoryBrief：叙事资产（用户想表达什么 + 照片承载的情感 + 叙事结构）
- CreativePlan：Ocelot 产出的统一创意方案（视觉方向 + 音乐意图 + 对齐点）
- VisualScript：Kitten 产出的视觉脚本（场景、字幕、时长、转场）
- RenderScript：渲染脚本（把叙事资产翻译成某个呈现层可消费的指令集）
- runId：一次运行的唯一标识，用于隔离产物目录
- tool：确定性的本地能力（如素材校验、渲染执行），不负责“理解用户”
- agent：面向意图的生成与决策单元（如对话与创意总监）

## 8) 入口索引（可选）

- `src/index.ts`：CLI 入口与交互起点
- `src/app/tui/render-story.command.ts`：命令入口（鉴权、参数与 TUI 驱动）
- `src/app/workflow/start-story-run.ts`：核心工作流编排（stages + 进度事件 + 产物落盘）
- `src/pipeline.ts`：对外门面（主流程入口）
