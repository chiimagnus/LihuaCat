# 仓库指南

## 项目结构与模块组织
本仓库为单包结构，不再使用 `pnpm workspace` 或 `packages/`。

- `src/`：核心代码（CLI 入口、业务编排、领域能力、模板渲染）。
- `tests/`：所有测试与测试脚本（含示例图片夹具）。
- `.github/docs/`：业务与架构文档。
- `.github/plans/`：实施计划文档。

目录组织优先按“业务能力”拆分，不按纯技术层拆分。

## 构建、测试和开发命令
- 安装依赖：`pnpm install`
- 全量测试：`pnpm test`
- 全量构建：`pnpm run build`
- 启动主流程：`pnpm run start`
- 开发态运行 CLI：`pnpm run dev --`
- 指定模型与推理强度：
  `pnpm run dev -- --input tests --model gpt-5.1-codex-mini --model-reasoning-effort medium`
- 快速运行：
  `pnpm run dev -- --input tests --mode template`
- 指定浏览器可执行文件：
  `pnpm run dev -- --input tests --mode template --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`

说明：CLI 现在是纯交互 TUI，要求在 TTY 终端中运行；非 TTY 环境会直接报错退出。参数未提供时会进入对应步骤的交互提问。

默认模型配置（真实链路）：
- model：`gpt-5.1-codex-mini`
- reasoning effort：`medium`

## 代码风格与命名规范
- 语言：TypeScript（ESM），保持 `strict` 风格，优先小函数与可测试边界。
- 命名：文件名使用 kebab-case；类型/类使用 PascalCase；变量/函数使用 camelCase。
- 业务约束需显式表达为类型和校验逻辑，不依赖隐式约定。
- 新增逻辑时优先补充 `tests/*.spec.ts`。

## 设计原则（重构与新增代码默认遵循）
- KISS：优先最直接可读方案，减少不必要层级。
- YAGNI：只实现当前确定需要的能力。
- DRY：重复达到 2 次以上再抽象。
- WET：先写两次再抽象，避免过早设计。
- SRP：函数/模块只承担单一职责。
- OCP：通过新增实现扩展，不反复改稳定主干。
- LSP：同抽象下不同实现可替换且行为一致。
- ISP：接口保持小而专一。
- DIP：编排层依赖抽象端口，不耦合具体实现。
- LoD：只与直接协作者交互，避免跨层深链路。
- SoC：编排、领域、模板渲染清晰分层。
- SLAP：同一函数保持同一抽象层级。

## 重构执行约束（明确要求“完全重构”时）
- 允许破坏性调整，不以向后兼容为默认目标。
- 不保留兼容层、过渡分支、双轨实现。
- 新方案落地后同步删除旧代码、旧导出、旧测试与无效注释。

## 测试指南
- 测试框架使用 Node 内置 test runner。
- 统一通过 `tests/run-tests.mjs` 发现并执行 `tests/*.spec.ts`。
- 测试命名建议：`<feature>.spec.ts`。
- 关键流程（渲染选择循环、脚本语义约束）必须有回归测试。

## 素材输入规则
- 仅扫描 `--input` 目录第一层文件，不递归子目录/孙目录。
- 仅支持 `jpg/jpeg/png`，最大 20 张。
- 目录内若出现 `webp/heic/heif/gif/bmp/tiff/avif` 会作为不支持格式报错。

## 安全与配置提示
- 不提交任何凭证（如 `~/.codex/auth.json`）或本地产物目录。
- `lihuacat-output/` 属于运行产物，必须保持在 `.gitignore` 中。
- 示例素材应保持小体积，避免污染仓库历史。
