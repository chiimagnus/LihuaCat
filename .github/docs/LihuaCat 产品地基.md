# LihuaCat 产品地基

## 一句话定义

> **LihuaCat = Glasses Agent（理解你）+ StoryBrief（叙事内核）+ 可插拔的呈现层**

LihuaCat 不是视频工具，不是漫画工具。它是一个把「用户的真实照片 + 用户的真实感受」转化成「某种可分享的叙事体验」的系统。

## 产品愿景

### 我们在解决什么问题？

大多数人打开相册，看着一堆照片，心里有一团模糊的感觉，但说不出来。"就是觉得那天挺开心的""有点怀念吧"——然后就关掉了。

市面上能做「图片 → 视频」的工具很多（剪映模板、CapCut 一键出片、微信照片电影），但它们解决的是**呈现问题**——怎么把图片排好看。没有人在解决**表达问题**——用户心里那团模糊的感受，怎么变成一个有灵魂的故事。

### LihuaCat 想成为什么？

一个**帮用户搞清楚自己到底想表达什么**的系统。然后把它变成可以分享的叙事体验。

**核心体验承诺**：用户看着最终产出时，会有一个「对，就是这个感觉」的瞬间。

### 和别人不一样的地方

| 维度 | 传统工具 | LihuaCat |
| --- | --- | --- |
| 输入 | 图片 | 图片   **• 用户的感受** |
| 谁决定故事 | AI 或模板 | **用户的感受决定故事**，AI 帮忙表达 |
| 用户做什么 | 选模板、选滤镜、选音乐 | **聊聊天，说说心里话** |
| 产出 | 好看的视频 | **「被理解了」的感觉**  • 承载这种理解的叙事体验 |
| 分享动机 | "看看我做的视频" | **"这就是那天的感觉"** |

### 用户是谁？

暂不锁定具体画像。先从自己出发——Chii 就是第一个用户。

一个直觉：LihuaCat 可能不是一个"随便玩玩"的日常工具，而是一个**在特殊时刻才会打开的东西**——低频但高价值。愿意花时间跟 Glasses Agent 深聊感受的人，往往是因为那组照片对他们真的很重要。

这个假设需要验证，后续持续更新。

### 怎么验证「被理解」？

最粗暴但最有效的方式：做出来后，用户愿不愿意发给**那个特定的人**看。不是发朋友圈，是发给「那个人」。

### 商业模式

（待探索。但有一个不变的约束——）

- **本地优先**：所有渲染在用户机器上完成
- **用户自带 AI**：AI 能力由用户自己的 Codex/ChatGPT 账号承担
- **开发者零运维**：不跑服务器，不存数据

## 地基性的信念

1. **用户真实的图片 + 用户真实的感受 = 有灵魂的叙事体验**
2. **输出形态是可替换的，理解用户的能力是不可替换的**
3. **Glasses Agent 是产品的灵魂，它的质量决定产品的上限**
4. **本地优先、用户自带 AI、开发者零运维**——这个不变

## 三层核心架构

### 第一层：理解（Glasses Agent）

- **角色**：总导演，拥有全部上下文和调度权
- **能力**：多轮多模态对话（看图 + 聊天）、分析素材、拟大纲、调度子 agent、最终拍板
- **三种对话模式**：全局聊 / 聚焦单张图片 / 收束确认，自然切换
- **核心产出**：`CreativeIntent`（用户到底想表达什么）+ `PhotoNote[]`（每张照片的情感标注）
- **关键设计**：用户说的那句话（风格 preset + 补充描述）就是「有色眼镜」的起点，Glasses Agent 负责把它撑开、深挖、丰富

### 第二层：创作（Narrator + Critic，受 Glasses 调度）

- **Narrator（编剧）**：接收 StoryBrief → 输出完整叙事脚本。被调用，无自主权
- **Critic（审稿）**：接收 CreativeIntent + 图片 + 脚本 → 输出审稿意见。被调用，无自主权
- **调度权在 Glasses**：什么时候调用谁、调用几次、审稿不通过怎么处理（改 brief / 让 Narrator 改 / 回去问用户），都由 Glasses 决定

### 第三层：呈现（Renderer，可插拔）

- 不同的 Renderer 把同一个 StoryBrief 翻译成不同输出
- **当前**：Remotion 视频渲染（已有）
- **未来可能**：漫画书、Apple Vision Pro 沉浸式场景、甚至更多形态
- 输出形态是可插拔的，前两层的核心能力不变

## StoryBrief：核心资产

StoryBrief 是输出无关的叙事内核，描述「讲什么、怎么讲、什么节奏」，不涉及呈现方式。

```tsx
interface StoryBrief {
  intent: CreativeIntent
  photos: PhotoNote[]
  narrative: NarrativeStructure
}

interface CreativeIntent {
  coreEmotion: string       // "异地重逢的珍贵感"
  tone: string              // "克制的温柔，不煽情"
  narrativeArc: string      // "从期待 → 见面的小确幸 → 离别前的沉默"
  audienceNote: string      // "发给她看的，她会懂"
  avoidance: string[]       // ["不要用'岁月静好'这种词"]
  rawUserWords: string      // 保留用户原话，供后续 agent 参考语气
}

interface PhotoNote {
  photoRef: string
  userSaid: string          // 用户关于这张图的原话（如果聊过）
  emotionalWeight: number   // 0-1
  suggestedRole: string     // "开场" | "高潮" | "转折" | "收尾" | "过渡"
  backstory: string         // 用户聊出来的背后故事
  analysis: string          // AI 的视觉分析（戴着眼镜的）
}

interface NarrativeStructure {
  arc: string
  beats: StoryBeat[]
}

interface StoryBeat {
  photoRefs: string[]
  moment: string
  emotion: string
  duration: "short" | "medium" | "long"
  transition: string
}
```

## Agent 权力结构

| Agent | 定位 | 权限 |
| --- | --- | --- |
| **Glasses** | 总导演 | 看图、聊天、分析、拟大纲、调度子 agent、最终拍板 |
| **Narrator** | 编剧工具人 | 接收 StoryBrief，输出 story-script，被调用、无自主权 |
| **Critic** | 审稿工具人 | 接收意图+图片+脚本，输出审稿意见，被调用、无自主权 |

## 分阶段落地

| 阶段 | 做什么 |
| --- | --- |
| **P1** | Glasses Agent 的对话能力：多轮文本 + 单张图片聚焦 + 输出 StoryBrief |
| **P2** | 接入 Narrator + Critic 作为 Glasses 的 tool call，跑通调度闭环 |
| **P3** | Critic 不通过时的自主决策循环 |
| **P4** | 更多 Renderer（漫画、AVP 沉浸式等）+ 音乐/风格自动匹配 |