# 狸花猫（图片首版，数据驱动渲染）实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。  
> 执行策略：不使用 TDD，采用“先实现最小可运行功能，再补测试与回归验证”。

**Goal（目标）:**  
实现“图片目录 -> story-script.json -> 二选一渲染（模板 / AI 代码）-> 成功出片并展示关键路径”的可稳定闭环（MVP）。

**Non-goals（非目标）:**  
不支持视频输入、不做配音/配乐、不做自动时长、不做 GUI、不做移动端。

**Approach（方案）:**  
采用“数据驱动优先”：`story-script.json` 作为唯一业务契约，渲染层只消费脚本。目录结构按业务能力分组，而不是按技术层分组。主流程先做稳定模板渲染，同时提供实验模式（AI 代码渲染）作为可选路径；实验模式失败不自动回退，返回二选一菜单。所有关键步骤具备测试与日志，最终以“同输入 10 次成功率 >= 90%”验收模板主路径稳定性。

**Acceptance（验收）:**  
1. 仅支持图片目录输入，图片上限 20 张，超限直接报错。  
2. 支持 `jpg/jpeg/png`，原格式直通，不做图片预处理转换。  
3. 生成 `story-script.json` 时：失败自动重试 2 次，重试后仍失败则终止。  
4. 脚本满足：30 秒、1080x1920、每张图至少出现一次、每张至少 1 秒。  
5. 每次渲染前都弹二选一：模板渲染 / AI 代码渲染。  
6. AI 代码渲染失败：提示原因并返回二选一菜单。  
7. 模板渲染失败：提示原因并返回二选一菜单。  
8. 任一模式成功后立即结束，展示视频路径、脚本路径、日志路径、生成代码路径（若有）。  
9. 输出目录为 `<素材目录>/lihuacat-output/<runId>/`。  
10. 模板模式稳定性：同一输入连续 10 次，成功率 >= 90%。  

---

## Plan A（主方案）

### 目录约定（业务逻辑优先）

```text
packages/
  story-pipeline/
    src/domains/
      run-setup/
      material-intake/
      story-script/
      render-choice/
      template-render/
      ai-code-render/
      artifact-publish/
    src/contracts/
    src/workflow/
  story-console/
    src/flows/
      create-story-video/
    src/commands/
  story-video/
    src/story-template/
    src/story-template/StoryComposition.tsx
    src/story-template/StoryRoot.tsx
```

说明：允许在每个业务域内部再细分 `application/domain/infra`，但顶层必须先按业务能力命名。

### P1（最高优先级）：打通数据驱动闭环

### ✅Task 1: 建立工作区与业务导向骨架

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/story-pipeline/package.json`
- Create: `packages/story-console/package.json`
- Create: `packages/story-video/package.json`
- Create: `packages/story-pipeline/src/workflow/start-story-run.ts`
- Test: `packages/story-pipeline/src/workflow/start-story-run.spec.ts`

**Step 1: 实现 workflow 最小入口**

实现 `startStoryRun()` 返回结构化 `runId` 和 `outputDir`。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/start-story-run.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

实现 `startStoryRun()` 最小版本，先只生成 `runId` 与输出目录字符串。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/start-story-run.spec.ts`  
Expected: PASS

### ✅Task 2: 图片输入校验（目录、格式、上限）

**Files:**
- Create: `packages/story-pipeline/src/domains/material-intake/collect-images.ts`
- Create: `packages/story-pipeline/src/domains/material-intake/material-intake.errors.ts`
- Test: `packages/story-pipeline/src/domains/material-intake/collect-images.spec.ts`

**Step 1: 实现最小功能**

覆盖场景：目录不存在、空目录、超过 20 张、存在不支持格式、正常目录。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/material-intake/collect-images.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

实现目录读取、扩展名白名单、最大数量限制，并返回标准化素材列表。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/material-intake/collect-images.spec.ts`  
Expected: PASS

### ✅Task 3: 移除图片预处理能力（保留原格式直通）

**Files:**
- Delete: `packages/story-pipeline/src/domains/image-normalization/normalize-images-to-jpg.ts`
- Delete: `packages/story-pipeline/src/domains/image-normalization/image-normalization.errors.ts`
- Delete: `packages/story-pipeline/src/domains/image-normalization/normalize-images-to-jpg.spec.ts`

**Step 1: 实现最小功能**

验证：`material-intake` 返回的 `jpg/jpeg/png` 文件路径可直接进入后续流程，无中间转码目录。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/material-intake/collect-images.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

删除图片预处理实现，并清理所有对 `image-normalization` 的引用。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/material-intake/collect-images.spec.ts`  
Expected: PASS

### ✅Task 4: `story-script` 契约与双层校验

**Files:**
- Create: `packages/story-pipeline/src/contracts/story-script.schema.json`
- Create: `packages/story-pipeline/src/domains/story-script/validate-story-script.ts`
- Create: `packages/story-pipeline/src/domains/story-script/validate-story-script.semantics.ts`
- Test: `packages/story-pipeline/src/domains/story-script/validate-story-script.spec.ts`

**Step 1: 实现最小功能**

覆盖：字段缺失、总时长不为 30 秒、未覆盖全部图片、段落 <1 秒、合法脚本。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/story-script/validate-story-script.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

使用 `ajv` 做结构校验，并增加语义规则校验函数。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/story-script/validate-story-script.spec.ts`  
Expected: PASS

### ✅Task 5: 故事脚本生成与 2 次自动重试

**Files:**
- Create: `packages/story-pipeline/src/domains/story-script/generate-story-script.ts`
- Create: `packages/story-pipeline/src/domains/story-script/story-agent.client.ts`
- Test: `packages/story-pipeline/src/domains/story-script/generate-story-script.spec.ts`

**Step 1: 实现最小功能**

模拟 AI 第 1/2 次返回非法脚本，第 3 次返回合法脚本；以及 3 次都失败的场景。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/story-script/generate-story-script.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

实现固定重试上限 2（总尝试 3 次）、错误聚合与最终失败落盘信息。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/story-script/generate-story-script.spec.ts`  
Expected: PASS

### ✅Task 6: 渲染二选一循环状态机

**Files:**
- Create: `packages/story-pipeline/src/domains/render-choice/render-choice-machine.ts`
- Test: `packages/story-pipeline/src/domains/render-choice/render-choice-machine.spec.ts`

**Step 1: 实现最小功能**

覆盖：  
- 每轮都要求用户二选一。  
- AI 代码失败 -> 返回选择菜单。  
- 模板失败 -> 返回选择菜单。  
- 任一成功 -> 结束流程。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/render-choice/render-choice-machine.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

实现 `SELECT_MODE -> RENDER -> (SUCCESS | FAIL_BACK_TO_SELECT)` 状态迁移。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/render-choice/render-choice-machine.spec.ts`  
Expected: PASS

### ✅Task 7: 模板渲染路径（数据驱动）

**Files:**
- Create: `packages/story-pipeline/src/domains/template-render/render-by-template.ts`
- Modify: `packages/story-video/src/story-template/StoryComposition.tsx`
- Modify: `packages/story-video/src/story-template/StoryRoot.tsx`
- Test: `packages/story-pipeline/src/domains/template-render/render-by-template.spec.ts`

**Step 1: 实现最小功能**

断言模板渲染会消费 `story-script.json` 并产出 `video.mp4`。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/template-render/render-by-template.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

固定 `1080x1920@30fps@30s`，按 timeline 映射 `<Sequence>` 渲染。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/template-render/render-by-template.spec.ts`  
Expected: PASS

### ✅Task 8: AI 代码渲染路径（实验模式）

**Files:**
- Create: `packages/story-pipeline/src/domains/ai-code-render/generate-remotion-scene.ts`
- Create: `packages/story-pipeline/src/domains/ai-code-render/render-by-ai-code.ts`
- Test: `packages/story-pipeline/src/domains/ai-code-render/render-by-ai-code.spec.ts`

**Step 1: 实现最小功能**

覆盖：基于脚本生成代码、代码保存到输出目录、渲染失败返回结构化错误。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/ai-code-render/render-by-ai-code.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

实现 `story-script -> generated-remotion/ -> compile -> render`，失败不自动重试。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/ai-code-render/render-by-ai-code.spec.ts`  
Expected: PASS

### ✅Task 9: 产物发布与关键路径汇总

**Files:**
- Create: `packages/story-pipeline/src/domains/artifact-publish/publish-artifacts.ts`
- Create: `packages/story-pipeline/src/domains/artifact-publish/build-run-summary.ts`
- Test: `packages/story-pipeline/src/domains/artifact-publish/publish-artifacts.spec.ts`

**Step 1: 实现最小功能**

断言成功后 summary 必含：`videoPath`、`storyScriptPath`、`runLogPath`、`generatedCodePath?`。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/artifact-publish/publish-artifacts.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

统一落盘到 `<素材目录>/lihuacat-output/<runId>/`，并构造用户可读摘要。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/domains/artifact-publish/publish-artifacts.spec.ts`  
Expected: PASS

### ✅Task 10: 编排器端到端（无 TUI）

**Files:**
- Modify: `packages/story-pipeline/src/workflow/start-story-run.ts`
- Test: `packages/story-pipeline/src/workflow/start-story-run.e2e.spec.ts`

**Step 1: 实现最小功能**

Mock 依赖后跑完整流程，验证失败可回到二选一，成功即结束。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/start-story-run.e2e.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

串联所有 domain use case，并保证错误原因透传给交互层。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-pipeline test -- src/workflow/start-story-run.e2e.spec.ts`  
Expected: PASS

### P2（次优先级）：TUI 交互与命令入口

### ✅Task 11: 创建“生成故事视频”流程界面

**Files:**
- Create: `packages/story-console/src/flows/create-story-video/create-story-video.flow.tsx`
- Create: `packages/story-console/src/flows/create-story-video/use-create-story-video.ts`
- Test: `packages/story-console/src/flows/create-story-video/create-story-video.flow.spec.tsx`

**Step 1: 实现最小功能**

断言交互顺序：输入目录 -> 选风格 -> 输入补充描述 -> 二选一菜单。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-console test -- src/flows/create-story-video/create-story-video.flow.spec.tsx`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

接入 pipeline API，渲染进度、错误原因与二选一循环。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-console test -- src/flows/create-story-video/create-story-video.flow.spec.tsx`  
Expected: PASS

### ✅Task 12: CLI 命令与最终结果展示

**Files:**
- Create: `packages/story-console/src/commands/render-story.command.ts`
- Modify: `packages/story-console/src/index.ts`
- Test: `packages/story-console/src/commands/render-story.command.spec.ts`

**Step 1: 实现最小功能**

断言成功输出包含关键路径；失败输出包含可读错误原因。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-console test -- src/commands/render-story.command.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

实现命令入口，桥接 flow 与 pipeline，统一退出码。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-console test -- src/commands/render-story.command.spec.ts`  
Expected: PASS

### P3（稳定性与回归）：验收脚本与基线

### ✅Task 13: 增加稳定性回归脚本（10 次）

**Files:**
- Create: `scripts/stability-run.sh`
- Create: `scripts/fixtures/photos/`（测试素材）
- Create: `packages/story-console/src/__tests__/stability-smoke.spec.ts`

**Step 1: 实现最小功能**

定义稳定性统计输出格式（成功次数、失败次数、失败原因摘要）。

**Step 2: 运行验证命令并记录结果**

Run: `pnpm --filter @lihuacat/story-console test -- src/__tests__/stability-smoke.spec.ts`  
Expected: 命令可执行并输出当前状态（若失败则按日志修复后重跑）

**Step 3: 完成功能并补齐必要测试**

执行 10 次模板模式，输出成功率与失败日志索引。

**Step 4: 运行测试与回归验证**

Run: `pnpm --filter @lihuacat/story-console test -- src/__tests__/stability-smoke.spec.ts`  
Expected: PASS

### ✅Task 14: 全量回归与发布前验收

**Files:**
- Modify: `.github/docs/idea.md`（补充“已实现范围/已验证口径”）
- Create: `.github/docs/mvp-acceptance-checklist.md`

**Step 1: 执行全量验证**

Run: `pnpm -r test`

**Step 2: 执行端到端命令（本地）**

Run: `pnpm --filter @lihuacat/story-console dev -- --input <photos-dir>`

**Step 3: 执行稳定性验收**

Run: `bash scripts/stability-run.sh <photos-dir>`

**Step 4: 记录结果**

将结果写入 `mvp-acceptance-checklist.md`，标记 PASS/FAIL 与原因。

---

## 边界条件检查清单（执行时必须覆盖）

1. 输入目录存在但无可用图片。  
2. 输入目录包含 >20 张图片。  
3. 存在 JPG/JPEG/PNG 损坏文件。  
4. 脚本总时长不是 30 秒。  
5. 脚本漏掉某张图片。  
6. 某段时长小于 1 秒。  
7. 模板渲染失败后的重选循环。  
8. AI 代码渲染失败后的重选循环。  
9. 成功后关键路径展示完整性。  

## 回归策略

1. 每完成一个 P1 任务：运行该任务对应测试文件。  
2. 完成 P1 全部任务：运行 `pnpm --filter @lihuacat/story-pipeline test`。  
3. 完成 P2 全部任务：运行 `pnpm --filter @lihuacat/story-console test`。  
4. 发布前：运行 `pnpm -r test` + `scripts/stability-run.sh`。  

## 已确认实现约束

已确认：  
1. AI 代码渲染“编译失败”默认展示详细错误信息（用于开发调试）。  
2. TUI 二选一菜单不提供快捷键，不设置默认选中项。  

## 交接

可选下一步：
1. 直接进入执行：使用 `executing-plans`，按 P1 -> P2 -> P3 分批实现。  
2. 先 review：你先审计划，我根据意见调整后再执行。  
