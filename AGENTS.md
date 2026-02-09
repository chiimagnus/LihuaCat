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
- 指定模型与推理强度：  
  `pnpm --filter @lihuacat/story-console dev -- --input scripts/fixtures/photos --model gpt-5.1-codex-mini --model-reasoning-effort medium`
- 非交互测试（mock agent）：  
  `pnpm --filter @lihuacat/story-console dev -- --input scripts/fixtures/photos --mode template --mock-agent`
- 如需指定浏览器可执行文件：  
  `pnpm --filter @lihuacat/story-console dev -- --input scripts/fixtures/photos --mode template --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
- 稳定性测试（默认 10 次）：  
  `bash scripts/stability-run.sh scripts/fixtures/photos`

默认模型配置（真实链路）：
- model：`gpt-5.1-codex-mini`
- reasoning effort：`medium`

## 代码风格与命名规范
- 语言：TypeScript（ESM），保持 `strict` 风格，优先小函数与可测试边界。
- 命名：文件名使用 kebab-case；类型/类使用 PascalCase；变量/函数使用 camelCase。
- 业务约束需显式表达为类型和校验逻辑，不依赖隐式约定。
- 新增逻辑时优先补充同目录 `*.spec.ts`。

## 设计原则（重构与新增代码默认遵循）
- KISS：优先最直接可读方案，减少嵌套和间接层。
- YAGNI：不为“可能的未来需求”提前加参数、接口或模块。
- DRY：重复逻辑达到 2 次以上再抽象；抽象后保持命名语义清晰。
- WET：在抽象时机未成熟前允许短期重复，避免过度设计。
- SRP：函数/模块只承担一个职责，只有一个主要修改原因。
- OCP：通过扩展点（注入实现/新增模块）扩展能力，避免反复改稳定主干。
- LSP：同接口替换实现必须保持行为一致，并通过同一契约测试。
- ISP：接口保持小而专一，调用方不依赖无关能力。
- DIP：编排层依赖抽象端口，不直接耦合具体实现细节。
- LoD：避免跨层深链路调用，跨包优先使用门面导出。
- SoC：按业务关注点拆分模块（编排/领域/基础设施），避免混写。
- SLAP：同一函数保持单一抽象层级；编排函数不混入底层细节。

## 重构执行约束（明确要求“完全重构”时）
- 允许破坏性调整，不以向后兼容为默认目标。
- 不保留兼容层、过渡分支、双轨实现；新方案落地后同步删除旧代码。
- 每个重构任务必须包含“遗留清理”步骤：删除旧文件、旧导出、旧测试与无效注释。

## 测试指南
- 测试框架使用 Node 内置 test runner。
- `story-pipeline` 与 `story-console` 通过各自 `scripts/run-tests.mjs` 发现并执行测试。
- 测试命名建议：`<feature>.spec.ts`，覆盖成功路径、失败路径与边界条件。
- 对关键流程（渲染选择循环、脚本语义约束）必须有回归测试。

## 素材输入规则
- 仅扫描 `--input` 目录第一层文件，不递归子目录/孙目录。
- 仅支持 `jpg/jpeg/png`，最大 20 张。
- 目录内若出现 `webp/heic/heif/gif/bmp/tiff/avif` 会作为不支持格式报错。

## 安全与配置提示
- 不提交任何凭证（如 `~/.codex/auth.json`）或本地产物目录。
- `lihuacat-output/` 属于运行产物，必须保持在 `.gitignore` 中。
- 示例素材可提交小体积文件，避免大体积二进制占用仓库历史。
