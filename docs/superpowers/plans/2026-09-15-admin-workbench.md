# 管理工作台简化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/admin` 整理为保留左侧固定导航、层级清晰、装饰克制的管理工作台。

**Architecture:** 保持现有 Server Component、Supabase 查询和权限边界，只重构 `AdminShell`、总览页结构和 `sg-admin*` 样式。通过少量源码断言与 Playwright 页面检查，验证导航入口、总览内容移除和桌面/移动布局。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4、现有 `sg-*` CSS、lucide-react、Vitest、Playwright。

## Global Constraints

- 保留左侧固定导航和五个现有导航入口。
- 总览页移除 Workflow 说明面板、英文眉题和“今日庭院状态”。
- 不改变现有路由、Supabase 查询、权限校验、统计数据和表格字段。
- 只修改 `sg-admin*` 样式，优先使用现有 `--sg-*` 变量。
- 不引入新的 UI 库、渐变或装饰性背景；保留键盘焦点态和移动端可用性。
- 保留当前工作树中的无关变更，不执行 reset、checkout 或清理命令。

---

### Task 1: 导航壳简化

**Files:**
- Modify: `src/components/admin/AdminShell.tsx`
- Create: `src/components/admin/AdminShell.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `AdminShell({ children }: { children: React.ReactNode })` 保持不变。
- `ADMIN_NAV_ITEMS` 保持五个既有 href 和 label。

- [ ] **Step 1: 写失败源码测试**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/admin/AdminShell.tsx', 'utf8')

describe('admin shell navigation', () => {
  it('keeps five navigation entries and removes the decorative status note', () => {
    expect(source).toContain("href: '/admin'")
    expect(source).toContain("href: '/admin/knowledge'")
    expect(source).toContain("href: '/admin/resources'")
    expect(source).toContain("href: '/admin/skills'")
    expect(source).toContain("href: '/admin/settings'")
    expect(source).not.toContain('今日庭院状态')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/components/admin/AdminShell.test.tsx`

Expected: FAIL because `今日庭院状态` still exists。

- [ ] **Step 3: 修改导航壳**

移除侧栏状态提示，增加侧栏底部“返回前台”链接；保持品牌和五个业务导航入口。为当前项增加基于 `usePathname()` 的 `aria-current="page"` 和 `sg-admin__nav-link--active`，不改变 href。

- [ ] **Step 4: 调整侧栏 CSS**

将桌面侧栏宽度收敛到 `13rem`，降低间距和背景对比度；新增 active 状态的左侧强调线；移动端保留图标和短文本横向导航，不显示状态提示。

- [ ] **Step 5: 运行测试和定向检查**

Run: `pnpm exec vitest run src/components/admin/AdminShell.test.tsx && pnpm eslint src/components/admin/AdminShell.tsx`

Expected: test pass and no ESLint errors。

### Task 2: 总览页内容收敛

**Files:**
- Modify: `src/app/admin/page.tsx`
- Create: `src/app/admin/page.test.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- `AdminDashboardPage()` 保持异步 Server Component 和现有查询调用。
- `StatCard` 保持 `href`、`label`、`value`、`icon` 入参类型。

- [ ] **Step 1: 写失败源码测试**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/admin/page.tsx', 'utf8')

describe('admin dashboard hierarchy', () => {
  it('does not render promotional workflow content or English eyebrow labels', () => {
    expect(source).not.toContain('从收集到沉淀')
    expect(source).not.toContain('WORKFLOW')
    expect(source).not.toContain('SPIRITGARDEN ADMIN')
    expect(source).not.toContain('RECENT NOTES')
    expect(source).toContain('最近加入的知识')
    expect(source).toContain('资产概览')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/app/admin/page.test.ts`

Expected: FAIL because Workflow 和英文眉题仍存在。

- [ ] **Step 3: 修改总览 JSX**

删除右侧 `sg-admin-panel--accent` 说明面板和英文眉题；保留标题、副标题、返回前台、三项统计和最近知识面板。将内容网格改为总览主面板单列结构，不改查询和数据映射。

- [ ] **Step 4: 调整总览 CSS**

统计区保留三列但使用统一浅边框；内容区改为单列最大宽度；标题字号使用后台级别，减少上下留白。移动端统计区单列。

- [ ] **Step 5: 运行测试和定向检查**

Run: `pnpm exec vitest run src/app/admin/page.test.ts && pnpm eslint src/app/admin/page.tsx`

Expected: test pass and no ESLint errors。

### Task 3: 子页面标题和表格一致性

**Files:**
- Modify: `src/app/admin/knowledge/page.tsx`
- Modify: `src/app/admin/resources/page.tsx`
- Modify: `src/app/admin/skills/page.tsx`
- Modify: `src/app/admin/settings/page.tsx`
- Modify: `src/app/globals.css`
- Create: `e2e/admin-workbench.spec.ts`

**Interfaces:**
- 所有页面保留现有默认导出、权限校验和数据字段。
- 子页面继续使用现有 `/admin/*` 路由。

- [ ] **Step 1: 写页面验收测试**

```ts
import { test, expect } from '@playwright/test'

test('admin routes expose the fixed navigation when authenticated', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.locator('.sg-admin__sidebar')).toBeVisible()
  await expect(page.getByRole('link', { name: '仪表盘' })).toBeVisible()
  await expect(page.getByRole('link', { name: '知识库' })).toBeVisible()
  await expect(page.getByRole('link', { name: '资源管理' })).toBeVisible()
  await expect(page.getByRole('link', { name: '技能管理' })).toBeVisible()
  await expect(page.getByRole('link', { name: '系统设置' })).toBeVisible()
})
```

- [ ] **Step 2: 运行页面测试确认当前环境结果**

Run: `pnpm exec playwright test e2e/admin-workbench.spec.ts --project=chromium`

Expected: 在可用浏览器和管理员会话下执行；无会话时记录登录重定向，不修改权限逻辑。

- [ ] **Step 3: 统一子页面结构**

保留“返回仪表盘”作为轻量文字链接，统一 header 间距和标题层级；不增加新的业务卡片或操作按钮。

- [ ] **Step 4: 优化表格和空状态样式**

统一表格容器边框、行高、表头颜色和横向滚动；错误/空状态继续使用现有文案和语义类名。

- [ ] **Step 5: 运行定向检查**

Run: `pnpm eslint src/app/admin/knowledge/page.tsx src/app/admin/resources/page.tsx src/app/admin/skills/page.tsx src/app/admin/settings/page.tsx && pnpm tsc --noEmit`

Expected: 定向 ESLint 通过；全局类型错误若仍为既有基线则记录，不扩大修复范围。

### Task 4: 全量验证与 Code Review 自检

**Files:**
- Modify only files from Tasks 1–3 if feature-specific verification fails.

- [ ] **Step 1: 运行管理端源码测试**

Run: `pnpm exec vitest run src/components/admin/AdminShell.test.tsx src/app/admin/page.test.ts`

Expected: all admin hierarchy tests pass。

- [ ] **Step 2: 运行定向 ESLint 与 diff 检查**

Run: `pnpm eslint src/components/admin src/app/admin src/app/globals.css && git diff --check`

Expected: no feature-specific lint or whitespace errors。

- [ ] **Step 3: 运行 Playwright 页面检查**

Run: `pnpm exec playwright test e2e/admin-workbench.spec.ts --project=chromium`

Expected: authenticated admin layout checks pass；若浏览器权限或登录环境阻塞，记录具体错误。

- [ ] **Step 4: 执行 Code Review 自检**

确认：

- 左侧固定导航和五个 href 未改变；当前项有可见焦点和 active 状态。
- 总览不再包含 Workflow、英文眉题和“今日庭院状态”。
- Supabase 查询、权限判断、统计和表格字段未改变。
- 桌面端侧栏宽度稳定，移动端导航可横向使用，无文字重叠。
- 无新增未清理订阅、定时器、请求或客户端状态。
- 只修改管理工作台相关文件，保留其他未提交变更。

- [ ] **Step 5: 运行生产构建**

Run: `pnpm build`

Expected: 构建通过；若网络字体下载失败，记录为环境阻塞。

