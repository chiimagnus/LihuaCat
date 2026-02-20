# 音乐生成 Agent + Ocelot 架构升级：可执行设计要点

上次编辑时间: 2026年2月20日 12:52
创建时间: 2026年2月20日 11:10
状态: 进行中
类型: plans

## Goal

为 LihuaCat 新增**本地音乐生成能力**，同时将 Ocelot 从"编剧"升级为**创意总监**，统管视觉与音乐的创意决策、分发与审稿。

---

## Non-goals

- 不做云端音乐生成（守住本地优先 + 用户自带 AI + 开发者零运维）
- 不做带人声/歌词的音乐（仅纯音乐）
- 不在本阶段确定 MIDI 生成的具体技术路径（本地专用模型 vs Codex，后续单独探索）
- 不做音乐风格的用户自定义（首版由 Ocelot 的创意方案决定）

---

## 架构变更总览

### 现有架构

```mermaid
flowchart LR
  SB["StoryBrief"] --> Ocelot["🐆 Ocelot\n编剧"]
  Ocelot --> RS["RenderScript"]
  RS --> Render["🎬 本地渲染"]
  RS -.可选.-> Lynx["🐈‍⬛ Lynx\n审稿"]
  Lynx -.修改建议.-> Ocelot
```

### 新架构

```mermaid
flowchart TD
  SB["StoryBrief"] --> Ocelot["🐆 Ocelot\n创意总监"]

  subgraph creative ["创意层：Ocelot 统管"]
    direction TB
    Ocelot --> CP["CreativePlan\n整体创意方案"]
    CP --> VisualSub["🐾 Kitten
视觉脚本"]
    CP --> MusicSub["🐾 Cub
音乐"]
    VisualSub --> VS["VisualScript\n视觉脚本"]
    MusicSub --> MIDI["MIDI 文件"]
    VS --> Review["🐆 Ocelot 审稿"]
    MIDI --> Review
    Review --"修改指令"--> VisualSub
    Review --"修改指令"--> MusicSub
  end

  Review --"通过 ✓"--> Merge["合并为 RenderScript"]
  Merge --> SFRender["SoundFont 合成音频"]
  SFRender --> Remotion["🎬 Remotion 渲染最终作品"]
```

---

## 核心执行单元变更

<aside>
🐾

**命名规则**：Agent（如 🐱 Tabby、🐆 Ocelot）使用成年猫科动物命名，拥有独立决策权；Sub-agent（如 🐾 Kitten、🐾 Cub）使用年幼猫科动物命名，是 Agent 下属的专项执行器，不具备独立决策权。

</aside>

### 🐆 Ocelot（编剧 → 创意总监）

- **新职责**：
    1. 读取 StoryBrief，产出 **CreativePlan**（整体创意方案，含视觉方向 + 音乐意图）
    2. 将 CreativePlan 分发给 Kitten（视觉脚本）和 Cub（音乐）
    3. 收集两者产出，做**统一审稿**：忠实度（是否表达了用户感受）+ 一致性（视觉与音乐是否对齐）
    4. 审稿不通过时，给对应 sub-agent（Kitten / Cub）**具体修改指令**（改稿制，不重跑）
- **取代 Lynx**：审稿职责内化为 Ocelot 的"收活审稿"环节
- **轮次上限**：审稿-改稿循环最多 N 轮（建议 N=3），超限则以当前版本为准并记录警告

### 🐾 Kitten — 视觉脚本 Sub-agent（新，从 Ocelot 拆出）

- **输入**：CreativePlan 中的视觉方向 + 图片列表
- **输出**：VisualScript（分镜顺序、时长、转场、字幕文案、情绪节奏）
- **本质**：原来 Ocelot 亲自干的活，现在独立为 sub-agent
- **支持改稿**：接收 Ocelot 的修改指令，在原稿基础上修改

### 🐾 Cub — 音乐 Sub-agent（新增）

- **输入**：CreativePlan 中的音乐意图（情绪弧线、节奏走向、关键转折点、总时长）
- **输出**：MIDI 文件（纯音乐）
- **生成方式**：文本描述 → MIDI（具体技术路径后续确定）
- **支持改稿**：接收 Ocelot 的修改指令，在原 MIDI 基础上调整

### 🐈‍⬛ Lynx（取消）

- 审稿职责已并入 Ocelot 的创意总监角色
- 不再作为独立 agent 存在

---

## 新增数据合同

### CreativePlan（创意方案）

Ocelot 审阅 StoryBrief 后产出的整体创意方案，是 Kitten 和 Cub 的共同输入：

- **叙事弧线**：整体情绪走向（开篇 → 发展 → 高潮 → 收束）
- **视觉方向**：分镜风格、节奏基调、转场基调、字幕风格
- **音乐意图**（粗粒度）：
    - 整体情绪关键词（如"温暖怀旧""轻快明亮"）
    - 节奏走向（与叙事弧线对齐的 BPM 变化趋势）
    - 关键转折点时间标记（与分镜对齐）
    - 配器建议（可选，如"钢琴为主""弦乐铺底"）
    - 总时长
- **对齐约束**：视觉和音乐必须在哪些时间点/情绪节点对齐

### VisualScript（视觉脚本）

从 RenderScript 中拆出的视觉部分，和现有 RenderScript 的视觉内容基本一致。

### RenderScript（渲染脚本，更新）

审稿通过后，由 VisualScript + MIDI 引用合并而成：

- 视觉指令（来自 VisualScript）
- 音频引用（指向生成的 MIDI → 合成后的音频文件路径）
- 合并逻辑由确定性 tool 完成，不涉及 LLM 判断

---

## 新增执行链路（渲染阶段）

```
MIDI 文件
  → SoundFont/合成器本地渲染 → WAV/MP3 音频文件
  → Remotion 将音频 + 视觉素材合成最终视频
```

- SoundFont 选择：首版内置一个通用 SoundFont（如 FluidR3），后续可支持用户自选
- 合成工具：可选 FluidSynth / Timidity++ / Node.js MIDI 合成库（具体后续确定）

---

## 用户流程变更

用户侧**零感知**——流程体验不变：

1. 选图片目录
2. 🐱 Tabby 聊感受
3. 确认
4. 等渲染
5. 拿到**带原创配乐的视频**（而不是无声/默认配乐视频）

唯一区别：产物目录多一个 MIDI 文件和合成后的音频文件。

---

## 错误处理与降级

- **Cub（音乐）生成失败**：Ocelot 可选择 fallback 到无配乐渲染，并在产物日志中记录
- **SoundFont 合成失败**：报错退出，留下 MIDI 文件供用户自行处理
- **审稿-改稿超限**：以当前版本为准继续渲染，日志记录警告

---

## 产物变更

`lihuacat-output/<runId>/` 新增：

- `creative-plan.json`：Ocelot 的整体创意方案（可审阅）
- `visual-script.json`：视觉脚本（从 RenderScript 拆出）
- `music.mid`：生成的 MIDI 文件（可审阅、可独立播放）
- `music.wav`（或 `.mp3`）：SoundFont 合成后的音频
- `review-log.json`：Ocelot 审稿记录（每轮的通过/不通过 + 修改指令）

---

## 术语表更新

- **CreativePlan**：Ocelot 产出的整体创意方案，视觉和音乐 sub-agent 的共同输入合同
- **VisualScript**：视觉脚本，从 RenderScript 拆出的视觉指令部分
- **Kitten（视觉脚本 Sub-agent）**：负责"创意方案 → 视觉分镜脚本"的专项执行器（原 Ocelot 的核心工作），以"幼猫"命名，表示 Ocelot 的下属执行者
- **Cub（音乐 Sub-agent）**：负责"文本描述 → MIDI"的专项执行器，以"幼崽"命名，表示 Ocelot 的下属执行者
- **改稿制**：审稿不通过时，由 Ocelot 给出具体修改指令，sub-agent 在原稿上修改（非重跑）

---

## 待后续确定

- [ ]  MIDI 生成技术路径：本地专用音乐模型 vs Codex/ChatGPT 直接生成
- [ ]  SoundFont 选型与合成工具链
- [ ]  CreativePlan 的详细 schema 设计
- [ ]  审稿-改稿轮次上限具体值（建议 3）