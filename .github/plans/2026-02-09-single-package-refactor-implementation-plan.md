# 单包化与目录收敛 实施计划

> 执行方式：建议使用 `executing-plans` 按批次实现与验收。

**Goal（目标）:** 将仓库从多包 workspace 重构为单包结构，统一源码到 `src/`、统一测试到 `tests/`，删除旧结构且不保留兼容层。

**Non-goals（非目标）:**
- 不做向后兼容
- 不保留旧命令别名
- 不引入新的渲染能力或产品功能

**Approach（方案）:**
- Plan A：先做目录与依赖收敛，再做路径修复与测试收敛，最后文档与清理同步。
- 小步移动文件，保持每一步可验证。
- 每个优先级结束后执行 `pnpm test` + `pnpm run build`。

**Acceptance（验收）:**
- 仓库根目录不存在 `packages/` 与 `pnpm-workspace.yaml`
- 所有源码从根 `src/` 可编译
- 所有测试从根 `tests/` 可执行
- 文档与命令示例无旧路径残留

---

## Plan A（主方案）

### P1（已完成）：三包合并到单一 `src/`

### Task 1: 迁移源码并修复跨包引用
**Files:**
- Modify: `src/**/*`
- Delete: `packages/**/*`

**验证:**
Run: `pnpm run build`
Expected: PASS

### Task 2: 合并依赖与根脚本
**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Delete: `pnpm-workspace.yaml`

**验证:**
Run: `pnpm install && pnpm run build`
Expected: PASS

### P2（已完成）：测试与脚本目录收敛

### Task 3: 扁平化 `tests/`（删除子文件夹）
**Files:**
- Move: `tests/console/*.spec.ts` -> `tests/*.spec.ts`
- Move: `tests/pipeline/*.spec.ts` -> `tests/*.spec.ts`
- Move: `tests/video/*.spec.ts` -> `tests/*.spec.ts`

**验证:**
Run: `pnpm test`
Expected: PASS

### Task 4: 将旧 `scripts/` 并入 `tests/`
**Files:**
- Move: `scripts/stability-run.sh` -> `tests/stability-run.sh`
- Move: `scripts/fixtures/photos/*` -> `tests/fixture-photo-*.jpeg`
- Delete: `scripts/`

**验证:**
Run: `bash tests/stability-run.sh tests`
Expected: 输出 `STABILITY_RESULT ...`

### Task 5: 修复路径与命令引用
**Files:**
- Modify: `tests/*.spec.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `.github/docs/business-logic.md`

**验证:**
Run: `pnpm test && pnpm run build`
Expected: PASS

### P3（已完成）：最终清理与回归

### Task 6: 旧结构残留扫描
**Files:**
- Scan only

**验证:**
Run: `rg "packages/story-|pnpm -r|pnpm --filter @lihuacat/story-console|scripts/fixtures/photos|scripts/stability-run.sh" .`
Expected: 无结果（或仅计划文档中的历史说明）

### Task 7: 最终回归
**Files:**
- Scan only

**验证:**
Run: `pnpm test && pnpm run build`
Expected: PASS
