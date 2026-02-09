# 仓库指南

## 项目结构与模块组织
本仓库使用 `pnpm workspace`，核心代码位于 `packages/`：

- `packages/story-pipeline`：业务编排核心（素材收集、脚本生成、渲染选择、产物发布）。
- `packages/story-console`：CLI/TUI 入口与交互流程。
- `packages/story-video`：模板相关代码（`src/story-template/`）。
- `scripts/`：项目级脚本与测试夹具（如稳定性脚本、示例素材）。
- `.github/docs/`：需求与验收文档；`.github/plans/`：实施计划。

目录组织优先按“业务能力”拆分，不按纯技术层拆分。

## 构建、测试和开发命令
- 安装依赖：`pnpm install`
- 全量测试：`pnpm -r test`
- 仅全量构建（workspace）：`pnpm -r build`
- 一键构建并启动主流程（根脚本）：`pnpm run build` 或 `npm run build`
- 仅启动主流程（不重新构建）：`pnpm run start` 或 `npm run start`
- 运行 CLI（开发态）：  
  `pnpm --filter @lihuacat/story-console dev --`
- 非交互测试（mock agent）：  
  `pnpm --filter @lihuacat/story-console dev -- --input scripts/fixtures/photos --mode template --mock-agent`
- 如需指定浏览器可执行文件：  
  `pnpm --filter @lihuacat/story-console dev -- --input scripts/fixtures/photos --mode template --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
- 稳定性测试（默认 10 次）：  
  `bash scripts/stability-run.sh scripts/fixtures/photos`

## 代码风格与命名规范
- 语言：TypeScript（ESM），保持 `strict` 风格，优先小函数与可测试边界。
- 命名：文件名使用 kebab-case；类型/类使用 PascalCase；变量/函数使用 camelCase。
- 业务约束需显式表达为类型和校验逻辑，不依赖隐式约定。
- 新增逻辑时优先补充同目录 `*.spec.ts`。

## 测试指南
- 测试框架使用 Node 内置 test runner。
- `story-pipeline` 与 `story-console` 通过各自 `scripts/run-tests.mjs` 发现并执行测试。
- 测试命名建议：`<feature>.spec.ts`，覆盖成功路径、失败路径与边界条件。
- 对关键流程（渲染选择循环、脚本语义约束）必须有回归测试。

## 安全与配置提示
- 不提交任何凭证（如 `~/.codex/auth.json`）或本地产物目录。
- `lihuacat-output/` 属于运行产物，必须保持在 `.gitignore` 中。
- 示例素材可提交小体积文件，避免大体积二进制占用仓库历史。
