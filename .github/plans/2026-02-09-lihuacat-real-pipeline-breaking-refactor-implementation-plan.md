# 狸花猫真实链路（破坏性重构）实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。  
> 执行策略：默认非 TDD（先实现最小可运行闭环，再补测试）。

**Goal（目标）:**  
将当前“可测试占位流程”重构为真实可用流程：终端问答交互 + 真实 Codex SDK 生成脚本 + 真实 Remotion 渲染 MP4（模板模式与 AI 代码模式都可真实出片）。

**Non-goals（非目标）:**  
不保留向后兼容；不做 Safari 支持；不做浏览器自动下载；不做视频输入；不做 GUI。

**Approach（方案）:**  
采用破坏性重构：删除旧占位渲染逻辑与兼容分支，重写核心链路。认证强制复用 Codex CLI 登录态，默认真实链路运行，仅保留 `--mock-agent` 供本地测试。渲染统一使用 `@remotion/renderer`，浏览器自动探测本机 Chromium 家族（Chrome / Edge / Arc / Brave），并支持 `--browser-executable` 覆盖，找不到直接报错。AI 代码模式通过生成 `generated-remotion/Scene.tsx` 接入固定 Root/Composition 渲染。

**Acceptance（验收）:**  
1. 默认运行路径为真实 Codex SDK + 真实 Remotion 渲染（非 mock）。  
2. 未登录 Codex CLI 时，命令立即失败并提示 `codex login`。  
3. 模板模式可真实输出 MP4。  
4. AI 代码模式可真实输出 MP4；失败时回到模式选择。  
5. 浏览器自动探测本机 Chrome/Edge/Arc/Brave，并支持 `--browser-executable` 覆盖；未找到则失败并输出可读错误。  
6. 仅支持 `jpg/jpeg/png`，输入上限 20 张。  
7. 每次渲染前提供终端二选一（模板 / AI 代码），无默认选中、无快捷键。  
8. 任一模式成功后结束，输出视频/脚本/日志/生成代码路径。  
9. 删除旧占位实现与兼容分支，不保留回退到旧行为。  

---

## Plan A（主方案）

### P1（最高优先级）：真实链路基础设施与破坏性清理

### Task 1: 删除旧占位实现与兼容分支（破坏性）

**Files:**
- Delete: `packages/story-pipeline/dist/`（整目录）
- Modify: `packages/story-pipeline/src/workflow/start-story-run.ts`
- Modify: `packages/story-pipeline/src/domains/template-render/render-by-template.ts`
- Modify: `packages/story-pipeline/src/domains/ai-code-render/render-by-ai-code.ts`
- Modify: `.gitignore`

**Step 1: 定义最小验收**
- 默认运行不得再写入“占位视频 JSON”。
- 流程中不允许自动回退 mock 或占位渲染。

**Step 2: 实现最小破坏性清理**
- 删除 `dist` 产物目录版本化内容。
- 删除旧渲染 adapter 的占位逻辑与相关 fallback 分支。

**Step 3: 补测试**
- 更新受影响测试，去除对占位行为断言。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-pipeline test`  
Expected: PASS

### Task 2: 锁定真实渲染与 SDK 依赖

**Files:**
- Modify: `package.json`
- Modify: `packages/story-pipeline/package.json`
- Modify: `packages/story-video/package.json`
- Modify: `packages/story-console/package.json`

**Step 1: 定义最小验收**
- 依赖锁定包含：`@openai/codex-sdk`、`remotion`、`@remotion/renderer`、`react`、`react-dom`、`zod@3.22.3`。

**Step 2: 实现**
- 写入各包依赖与 scripts（保持现有 workspace 结构）。

**Step 3: 补测试**
- 如脚本入口变化，补命令测试。

**Step 4: 验证**
Run: `pnpm install && pnpm -r test`  
Expected: PASS

### Task 3: 浏览器探测模块（Chrome/Edge/Arc/Brave）

**Files:**
- Create: `packages/story-pipeline/src/domains/template-render/browser-locator.ts`
- Test: `packages/story-pipeline/src/domains/template-render/browser-locator.spec.ts`

**Step 1: 定义最小验收**
- 探测 Chrome/Edge/Arc/Brave 可执行路径（macOS）。
- 找不到时返回结构化错误，不自动下载。

**Step 2: 实现**
- 探测常见路径并支持环境变量/CLI 传入覆盖。

**Step 3: 补测试**
- 覆盖：找到 Chrome、找到 Arc、找到 Brave、都找不到。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/template-render/browser-locator.spec.ts`  
Expected: PASS

### Task 4: Codex CLI 登录态校验与真实 SDK Client

**Files:**
- Create: `packages/story-pipeline/src/domains/story-script/codex-auth-guard.ts`
- Modify: `packages/story-pipeline/src/domains/story-script/story-agent.client.ts`
- Modify: `packages/story-pipeline/src/domains/story-script/generate-story-script.ts`
- Test: `packages/story-pipeline/src/domains/story-script/story-agent.client.spec.ts`

**Step 1: 定义最小验收**
- 未登录时立即失败并给出 `codex login` 指引。
- 支持 `--model` 覆盖；默认读取 Codex 配置。

**Step 2: 实现**
- 接入 `@openai/codex-sdk` 实际调用，移除默认空实现路径。

**Step 3: 补测试**
- mock SDK 返回结构化脚本、认证失败、模型覆盖参数传递。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/story-script/story-agent.client.spec.ts`  
Expected: PASS

### P2（次优先级）：真实 Remotion 渲染链路

### Task 5: 重建 story-video 模板为真实 Composition

**Files:**
- Modify: `packages/story-video/src/story-template/StoryComposition.tsx`
- Modify: `packages/story-video/src/story-template/StoryRoot.tsx`
- Create: `packages/story-video/src/story-template/StoryComposition.schema.ts`
- Test: `packages/story-video/src/story-template/StoryComposition.spec.ts`

**Step 1: 定义最小验收**
- 使用 `<Img>` 渲染图片，使用 `<Sequence>` 映射 timeline。
- Root 中固定 `1080x1920/30fps/30s`，并附 props schema。

**Step 2: 实现**
- 采用 Remotion best practices（Composition + schema + Sequence + premountFor）。

**Step 3: 补测试**
- 校验 props schema、timeline 到 frame 的映射正确性。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-video test`  
Expected: PASS

### Task 6: 模板模式真实渲染（@remotion/renderer）

**Files:**
- Modify: `packages/story-pipeline/src/domains/template-render/render-by-template.ts`
- Create: `packages/story-pipeline/src/domains/template-render/remotion-renderer.ts`
- Test: `packages/story-pipeline/src/domains/template-render/render-by-template.spec.ts`

**Step 1: 定义最小验收**
- `renderByTemplate` 输出真实 MP4 文件。
- 使用用户本机 Chrome/Edge/Arc/Brave 可执行路径（或 `--browser-executable` 覆盖）。

**Step 2: 实现**
- 通过 `@remotion/renderer` 调用 `renderMedia`。

**Step 3: 补测试**
- 单测 mock renderer；集成测试检查目标 MP4 文件存在且非空。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/template-render/render-by-template.spec.ts`  
Expected: PASS

### Task 7: AI 代码模式真实渲染

**Files:**
- Modify: `packages/story-pipeline/src/domains/ai-code-render/generate-remotion-scene.ts`
- Modify: `packages/story-pipeline/src/domains/ai-code-render/render-by-ai-code.ts`
- Modify: `packages/story-video/src/story-template/StoryRoot.tsx`
- Test: `packages/story-pipeline/src/domains/ai-code-render/render-by-ai-code.spec.ts`

**Step 1: 定义最小验收**
- 生成 `generated-remotion/Scene.tsx`。
- 通过固定 Root/Composition 加载并渲染真实 MP4。

**Step 2: 实现**
- `story-script -> Scene.tsx -> build/check -> renderMedia`。
- 失败时返回详细编译/渲染错误，回到模式选择。

**Step 3: 补测试**
- 覆盖：成功渲染、编译失败详情、渲染失败详情。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/ai-code-render/render-by-ai-code.spec.ts`  
Expected: PASS

### P3（交互与验收）：真实问答式 TUI + 文档收尾

### Task 8: 终端问答式交互（readline）重写

**Files:**
- Modify: `packages/story-console/src/index.ts`
- Modify: `packages/story-console/src/commands/render-story.command.ts`
- Modify: `packages/story-console/src/flows/create-story-video/create-story-video.flow.ts`
- Test: `packages/story-console/src/flows/create-story-video/create-story-video.flow.spec.ts`

**Step 1: 定义最小验收**
- 输入目录、风格、补充描述、模式二选一均可通过问答交互完成。
- 模式选择无默认选中、无快捷键。

**Step 2: 实现**
- 默认进入问答流；保留必要参数模式用于自动化测试。

**Step 3: 补测试**
- 覆盖交互顺序与“失败后返回二选一”行为。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-console test`  
Expected: PASS

### Task 9: 编排器整体验收（真实链路）

**Files:**
- Modify: `packages/story-pipeline/src/workflow/start-story-run.ts`
- Modify: `packages/story-pipeline/src/workflow/start-story-run.e2e.spec.ts`
- Modify: `scripts/stability-run.sh`

**Step 1: 定义最小验收**
- 默认真实链路运行；`--mock-agent` 仅测试用途。
- 模板与 AI 代码模式均能真实渲染成功。

**Step 2: 实现**
- 重写 e2e 场景与脚本参数，移除旧兼容分支。

**Step 3: 补测试**
- e2e 覆盖：AI 失败回菜单、模板成功结束、AI 成功结束。

**Step 4: 验证**
Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/start-story-run.e2e.spec.ts`  
Expected: PASS

### Task 10: 文档同步与旧方案下线

**Files:**
- Modify: `.github/docs/idea.md`
- Modify: `.github/docs/mvp-acceptance-checklist.md`
- Modify: `.github/plans/2026-02-08-lihuacat-data-driven-implementation-plan.md`
- Modify: `AGENTS.md`

**Step 1: 定义最小验收**
- 文档明确“默认真实链路”、“破坏性重构、不向后兼容”。
- 标记旧占位方案为废弃，不再作为现行实现依据。

**Step 2: 实现**
- 更新运行命令、失败排障和验收口径。

**Step 3: 补测试**
- N/A（文档任务）

**Step 4: 验证**
Run: `pnpm -r test && pnpm --filter @lihuacat/story-console dev -- --input scripts/fixtures/photos`  
Expected: 测试通过，命令可进入真实问答流程并最终产出真实 MP4

---

## 边界条件清单（必须覆盖）

1. 输入目录不存在或无可用图片。  
2. 图片数量 >20。  
3. 存在不支持格式（非 `jpg/jpeg/png`）。  
4. 未登录 Codex CLI。  
5. 本机无 Chrome/Edge/Arc/Brave 可执行文件，且未提供 `--browser-executable`。  
6. story-script 结构合法但语义不合法（时长/覆盖/最小时长）。  
7. AI 代码编译失败，需展示详细错误并回到模式选择。  
8. 模板渲染失败，需展示详细错误并回到模式选择。  

## 回归策略

1. 每完成一个 Task：运行该 Task 对应聚焦测试。  
2. 完成 P1：运行 `pnpm --filter @lihuacat/story-pipeline test`。  
3. 完成 P2：运行 `pnpm --filter @lihuacat/story-video test && pnpm --filter @lihuacat/story-pipeline test`。  
4. 完成 P3：运行 `pnpm -r test` + `bash scripts/stability-run.sh scripts/fixtures/photos`。  

## 交接

可选下一步：
1. 直接进入执行：使用 `executing-plans` 按 P1 -> P2 -> P3 分批实现。  
2. 先 review：你先审计划，我按你的意见修改后再执行。  
