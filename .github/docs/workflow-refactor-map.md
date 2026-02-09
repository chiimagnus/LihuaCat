# Workflow Refactor Map

## 1) Entry Chain

```text
story-console/src/index.ts
  -> story-console/src/commands/render-story.command.ts
    -> story-console/src/flows/create-story-video/create-story-video.flow.ts
      -> story-pipeline/src/index.ts (facade)
        -> story-pipeline/src/workflow/start-story-run.ts
          -> stages/{collect-images,generate-script,render,publish}.stage.ts
```

## 2) Runtime Artifacts

`runStoryWorkflow` 运行期间会在 `<inputDir>/lihuacat-output/<runId>/` 生成：
- `story-script.json`
- `run.log`
- `error.log`（失败时）
- `stages/run-context.json`
- `stages/material-intake.json`
- `stages/story-script-generated.json`
- `stages/progress-events.jsonl`
- `stages/render-attempts.jsonl`

## 3) Dependency Graph (Current)

```text
story-console
  -> story-pipeline/src/index.ts
       -> workflow/*
       -> domains/*

story-pipeline
  -> story-video/src/story-template/remotion-template.entry.tsx
```

说明：
- `story-console` 已不再 deep import `story-pipeline/src/domains/*` 与 `workflow/*`。
- `story-pipeline -> story-video` 仍是源码入口路径，后续可继续收敛为更稳定入口。

## 4) Principle -> Code Mapping

| Principle | Concrete Landing |
|---|---|
| KISS | `start-story-run.ts` 只保留编排，不承载 stage 细节 |
| YAGNI | `workflow-ports.ts` 只暴露当前已使用端口 |
| DRY | 统一进度与日志写入在 `workflow-runtime.ts` |
| WET | stage 内允许局部重复，避免过早抽象工具层 |
| SRP | 每个 stage 文件只负责单阶段职责 |
| OCP | 新渲染/发布实现通过 ports 注入扩展 |
| LSP | `runStoryWorkflow` 通过依赖注入可替换实现并由契约测试覆盖 |
| ISP | `WorkflowPorts` 拆分为最小必要能力集合 |
| DIP | `start-story-run.ts` 依赖 `WorkflowPorts` 抽象而非具体实现 |
| LoD | `story-console` 只依赖 `story-pipeline/src/index.ts` |
| SoC | console/pipeline/video 分层明确 |
| SLAP | orchestrator 与 stage 内部保持单一抽象层次 |

## 5) Removed Legacy Paths

已删除：
- `packages/story-console/src/flows/create-story-video/use-create-story-video.ts`
- `packages/story-pipeline/scripts/run-tests.mjs`
- `packages/story-console/scripts/run-tests.mjs`
- `packages/story-video/scripts/run-tests.mjs`

已迁移：
- `*.spec.ts` 从 `packages/*/src/**` 迁移到 `packages/*/tests/`
- 错误映射从 `render-story.command.ts` 内联逻辑迁移到 `render-story.error-mapper.ts`

## 6) Contract Tests

工作流契约测试：
- `packages/story-pipeline/tests/workflow-contract.spec.ts`

覆盖核心契约：
- 阶段事件顺序
- AI render 失败后重新选择模式
- 失败后 `exit` 的错误语义
