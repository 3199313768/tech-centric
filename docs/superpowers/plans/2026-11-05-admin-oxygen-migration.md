# Admin Oxygen Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every admin management surface except the workflow canvas and node interactions to `@oxygen-design/ui` and `@oxygen-design/patterns` while preserving current data, permissions, CRUD, navigation persistence, and workflow behavior.

**Architecture:** Oxygen `AppShell` becomes the admin frame and `ConfigProvider` pins the admin to the default light theme. Server pages keep their data queries and delegate tables to small client components; the already-client knowledge workbench consumes Oxygen controls directly. The workflow workbench keeps its existing canvas subtree and replaces only its outer header, mode controls, save states, and empty-state action.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, `@oxygen-design/ui@0.2.0`, `@oxygen-design/patterns@0.2.0`.

## Global Constraints

- Preserve the current dirty worktree. Do not overwrite unrelated changes in workflow execution, state-store, package, or asset files.
- Do not commit, push, merge, deploy, or delete data.
- Keep existing routes, `requireSuperAdmin`, Supabase queries, CRUD handlers, permissions, and workflow execution behavior.
- Keep `WorkflowCanvas`, `WorkflowNode`, `WorkflowInspector`, `WorkflowPlayer`, and node interactions on their current implementation.
- Use Oxygen public exports and the Oxygen default light theme.
- Use Oxygen design tokens or component classes for new UI; do not add hard-coded colors.
- Preserve labels `仪表盘`, `知识库`, `资源管理`, `技能管理`, `流程工作台`, and `系统设置`.
- Preserve keyboard search with `/`, Escape dialog closing, save-in-progress protection, deletion confirmation, and navigation-order persistence.
- Use `@/lib/supabase/server` and `@/lib/supabase/client` according to the existing file context.
- Run commands with the repository's pnpm scripts and Node version requested by the project.

---

### Task 1: Establish Oxygen Admin Shell

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/components/admin/AdminShell.tsx`
- Test: `src/components/admin/AdminShell.test.ts`
- Style: `src/app/globals.css`

**Interfaces:**
- Consumes: `AppShell` from `@oxygen-design/patterns`; `Button`, `ConfigProvider`, `StatusMessage`, and `Typography` from `@oxygen-design/ui`.
- Produces: `AdminShell({ children, initialNavOrder })` with the same public props and unchanged Supabase `admin_nav_order` persistence.

- [ ] **Step 1: Update the shell contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/admin/AdminShell.tsx', 'utf8')
const layoutSource = readFileSync('src/app/admin/layout.tsx', 'utf8')
const styles = readFileSync('src/app/globals.css', 'utf8')

describe('admin shell navigation', () => {
  it('uses Oxygen shell and controls while preserving navigation behavior', () => {
    for (const item of [
      "href: '/admin'",
      "href: '/admin/knowledge'",
      "href: '/admin/resources'",
      "href: '/admin/skills'",
      "href: '/admin/workflows'",
      "href: '/admin/settings'",
    ]) expect(source).toContain(item)
    expect(source).toContain("from '@oxygen-design/patterns'")
    expect(source).toContain("from '@oxygen-design/ui'")
    expect(source).toContain('<AppShell')
    expect(source).toContain('<ConfigProvider')
    expect(source).toContain('<Button')
    expect(source).toContain('mobileNavigation')
    expect(source).toContain('admin_nav_order')
    expect(source).toContain('updateUser')
    expect(source).toContain('onDrop')
  })

  it('loads Oxygen styles and defines an admin layout adapter', () => {
    expect(layoutSource).toContain("@oxygen-design/ui/styles.css")
    expect(layoutSource).toContain("@oxygen-design/patterns/styles.css")
    expect(styles).toContain('.oxygen-admin-shell')
    expect(styles).toContain('.oxygen-admin-nav')
    expect(styles).toContain('.oxygen-admin-page')
  })
})
```

- [ ] **Step 2: Run the shell test and verify RED**

Run: `pnpm exec vitest run src/components/admin/AdminShell.test.ts`

Expected: FAIL because `AdminShell.tsx` does not yet contain `AppShell`, `ConfigProvider`, or the Oxygen imports.

- [ ] **Step 3: Import the package styles in the admin layout**

In `src/app/admin/layout.tsx`, add these imports before local imports:

```ts
import '@oxygen-design/ui/styles.css'
import '@oxygen-design/patterns/styles.css'
```

- [ ] **Step 4: Replace the fixed shell implementation**

In `src/components/admin/AdminShell.tsx`:

```tsx
import { AppShell } from '@oxygen-design/patterns'
import { Button, ConfigProvider, StatusMessage, Typography } from '@oxygen-design/ui'
```

Keep `ADMIN_NAV_ITEMS`, `restoreNavItems`, `handleDrop`, `createClient().auth.updateUser`, and the active-route predicate. Render a stable `NavItem` helper as:

```tsx
function AdminNavLink({ item, active, mobile, onDragStart, onDragEnd, onDrop }: AdminNavLinkProps) {
  const Icon = item.icon
  return (
    <Button
      asChild
      variant={active ? 'secondary' : 'ghost'}
      className="oxygen-admin-nav__link"
      data-active={active ? 'true' : undefined}
    >
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        draggable={!mobile}
        onDragStart={mobile ? undefined : onDragStart}
        onDragEnd={mobile ? undefined : onDragEnd}
        onDragOver={mobile ? undefined : (event) => event.preventDefault()}
        onDrop={mobile ? undefined : onDrop}
        title={mobile ? undefined : '拖动调整导航顺序'}
      >
        <Icon aria-hidden size={17} strokeWidth={1.8} />
        <span>{item.label}</span>
      </Link>
    </Button>
  )
}
```

Use `AppShell` with `title={activeLabel}`, desktop `sidebar`, duplicated `mobileNavigation`, and `topbarActions` containing an Oxygen `Button asChild` link to `/`. Set `ConfigProvider theme="light"` around the shell. Replace the save-error paragraph with `StatusMessage tone="error"` and use `Typography.Text` for brand subtitles.

- [ ] **Step 5: Add focused layout adapter styles**

Append an `Oxygen admin shell` section to `src/app/globals.css` with:

```css
.oxygen-admin-shell .oxygen-app-shell__content {
  padding: 0;
  max-width: none;
}

.oxygen-admin-shell .oxygen-app-shell__sidebar > .oxygen-admin-sidebar,
.oxygen-admin-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--oxygen-space-6);
  min-height: 100%;
  padding: var(--oxygen-space-4);
}

.oxygen-admin-nav {
  display: grid;
  gap: var(--oxygen-space-1);
}

.oxygen-admin-nav__link {
  justify-content: flex-start;
  width: 100%;
}

.oxygen-admin-nav__link[data-active='true'] {
  border-color: var(--oxygen-color-primary-border);
}

.oxygen-admin-brand {
  align-items: center;
  color: var(--oxygen-color-text);
  display: flex;
  gap: var(--oxygen-space-3);
  text-decoration: none;
}

.oxygen-admin-brand__mark {
  border: 1px solid var(--oxygen-color-border);
  border-radius: 50%;
  display: grid;
  height: 36px;
  overflow: hidden;
  place-items: center;
  width: 36px;
}

.oxygen-admin-page {
  display: grid;
  gap: var(--oxygen-space-6);
  padding: var(--oxygen-space-6);
}

.oxygen-admin-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--oxygen-space-2);
}

@media (width <= 820px) {
  .oxygen-admin-mobile-nav {
    display: grid;
    gap: var(--oxygen-space-1);
    padding-block: var(--oxygen-space-4);
  }
}
```

- [ ] **Step 6: Run the shell test and verify GREEN**

Run: `pnpm exec vitest run src/components/admin/AdminShell.test.ts`

Expected: PASS.

### Task 2: Migrate Dashboard and Static Admin Pages

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/resources/page.tsx`
- Modify: `src/app/admin/skills/page.tsx`
- Modify: `src/app/admin/settings/page.tsx`
- Create: `src/components/admin/AdminDataTable.tsx`
- Create: `src/components/admin/AdminDataTable.test.ts`
- Test: `src/app/admin/page.test.ts`

**Interfaces:**
- Consumes: existing `KbRecord`, `ResourceItem`, and `AgentSkill` query results.
- Produces: `ResourceAdminTable({ items }: { items: ResourceItem[] })` and `SkillAdminTable({ skills }: { skills: AgentSkill[] })`.

- [ ] **Step 1: Write failing page/table contract tests**

Update `src/app/admin/page.test.ts` to require `PageHeader`, `Card`, `Statistic`, `EmptyState`, and `StatusMessage`. Create `src/components/admin/AdminDataTable.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/admin/AdminDataTable.tsx', 'utf8')

describe('admin data tables', () => {
  it('uses the Oxygen table and renders the existing resource and skill fields', () => {
    expect(source).toContain("from '@oxygen-design/ui'")
    expect(source).toContain('<Table')
    for (const label of ['名称', '分类', '链接', '点击', '技能', '说明', '平台', '标签']) {
      expect(source).toContain(label)
    }
  })
})
```

- [ ] **Step 2: Run page/table tests and verify RED**

Run:

```bash
pnpm exec vitest run src/app/admin/page.test.ts src/components/admin/AdminDataTable.test.ts
```

Expected: FAIL because the files do not yet import Oxygen components or `AdminDataTable.tsx` does not exist.

- [ ] **Step 3: Implement `AdminDataTable.tsx`**

Define `TableColumn<ResourceItem>[]` and `TableColumn<AgentSkill>[]` inside the client module. Use `rowKey="id"`, `ellipsis` where current tables truncate or horizontal scrolling previously handled long text, and render links with `target="_blank" rel="noreferrer"`. Export:

```tsx
export function ResourceAdminTable({ items }: { items: ResourceItem[] }) {
  return <Table columns={resourceColumns} dataSource={items} rowKey="id" emptyText="暂无资源。" />
}

export function SkillAdminTable({ skills }: { skills: AgentSkill[] }) {
  return <Table columns={skillColumns} dataSource={skills} rowKey="id" emptyText="暂无技能。" />
}
```

Use `Tag` for skill tags and a native `ReactNode` expression that renders `-` when empty.

- [ ] **Step 4: Migrate the dashboard**

Use `PageHeader` for `庭院总览`, `Button asChild` with Next `Link` for `返回前台`, `Card` plus `Statistic` for three stats, `Card` for recent records, `StatusMessage` for record-load errors, and `EmptyState` for no records. Keep the exact data queries and `records.slice(0, 5)`.

- [ ] **Step 5: Migrate resource, skill, and settings pages**

Use `PageHeader` on each page and `ResourceAdminTable` / `SkillAdminTable` for data. Keep existing query error branches; convert them to `StatusMessage tone="error"`. Render settings as a `Card` with `EmptyState` title `暂无系统选项` and description `当前暂无需要配置的系统选项。`.

- [ ] **Step 6: Run page/table tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/app/admin/page.test.ts src/components/admin/AdminDataTable.test.ts
```

Expected: PASS.

### Task 3: Migrate Knowledge Workbench Controls

**Files:**
- Modify: `src/components/admin/KnowledgeWorkbench.tsx`
- Test: `src/components/admin/KnowledgeWorkbench.test.ts`
- Style: `src/app/globals.css`

**Interfaces:**
- Consumes: existing `createKbRecord`, `updateKbRecord`, `deleteKbRecord`, filters, constants, and `KbRecord`.
- Produces: the same `KnowledgeWorkbench({ initialRecords })` external interface and behavior.

- [ ] **Step 1: Update the knowledge workbench contract test**

Require Oxygen `Table`, `Dialog`, `AlertDialog`, `Field`, `Input`, `Textarea`, `Select`, `Button`, `PageHeader`, `EmptyState`, and `StatusMessage`. Assert the database-supported `KB_RECORD_TYPES.map` remains and raw `sg-modal-backdrop`, `sg-admin-table`, `<select`, and `<table` markup is absent.

- [ ] **Step 2: Run the knowledge test and verify RED**

Run: `pnpm exec vitest run src/components/admin/KnowledgeWorkbench.test.ts`

Expected: FAIL because the current implementation uses raw controls and `sg-admin-*` markup.

- [ ] **Step 3: Replace filters and page structure**

Use `PageHeader` with `新增知识` action, `Input` for keyword search, two controlled `Select` components with `all` sentinel values, and Oxygen `EmptyState` / `StatusMessage`. Keep the `searchRef`, `/` shortcut, filter state, and dialog state.

- [ ] **Step 4: Replace the record table**

Build typed columns with:

```tsx
const columns: TableColumn<KbRecord>[] = [
  { key: 'type', dataIndex: 'type', title: '类型', render: (value) => <Badge variant="secondary">{String(value)}</Badge> },
  { key: 'content', dataIndex: 'content', title: '内容', ellipsis: true },
  { key: 'tags', dataIndex: 'tags', title: '标签', render: (_, record) => record.tags?.length ? record.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '-' },
  { key: 'created_at', dataIndex: 'created_at', title: '创建时间', render: (value) => new Date(String(value)).toLocaleDateString('zh-CN') },
  { key: 'actions', title: '操作', render: (_, record) => <div className="oxygen-admin-row-actions">...</div> },
]
```

Use `Button variant="link"` for edit and `Button variant="link"` with destructive tone via `className="oxygen-admin-action--danger"` for delete. Use `Table` with `rowKey="id"` and `emptyText` derived from whether records exist.

- [ ] **Step 5: Replace the create/edit and delete dialogs**

Use controlled `Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}`. Add `DialogHeader`, `DialogTitle`, `DialogDescription`, three `Field` groups with `FieldLabel`, `FieldControl`, `FieldError`, and `DialogFooter`. Use `Input`, `Textarea`, `Select`, and `Button`.

Use controlled `AlertDialog` with `open={deletingId !== null}` and `onOpenChange={(open) => { if (!open) setDeletingId(null) }}`. The destructive `AlertDialogAction` invokes `handleDelete(deletingId)`. Keep the `isSaving` guard, mounted ref, save error, Escape behavior, and database type restriction.

- [ ] **Step 6: Add row/dialog adapter styles**

Add:

```css
.oxygen-admin-row-actions {
  align-items: center;
  display: flex;
  gap: var(--oxygen-space-2);
}

.oxygen-admin-action--danger {
  color: var(--oxygen-color-error);
}

.oxygen-admin-form {
  display: grid;
  gap: var(--oxygen-space-4);
}
```

- [ ] **Step 7: Run the knowledge test and verify GREEN**

Run: `pnpm exec vitest run src/components/admin/KnowledgeWorkbench.test.ts`

Expected: PASS.

### Task 4: Migrate Workflow Outer UI and Verify Whole Admin

**Files:**
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx`
- Modify: `src/components/admin/WorkflowWorkbench.test.ts`
- Modify: `src/app/globals.css`
- Verify only: `src/components/admin/workflows/WorkflowCanvas.tsx`
- Verify only: `src/components/admin/workflows/WorkflowNode.tsx`
- Verify only: `src/components/admin/workflows/WorkflowInspector.tsx`
- Verify only: `src/components/admin/workflows/WorkflowPlayer.tsx`

**Interfaces:**
- Consumes: existing workflow editor, saver, runtime, and node callbacks.
- Produces: unchanged `WorkflowWorkbench({ initialMetadata, initialRuns, userId })`; only outer JSX and styling change.

- [ ] **Step 1: Extend the workflow contract test**

Assert `WorkflowBench.tsx` imports `PageHeader`, `Button`, and `Badge` from Oxygen, renders `<PageHeader`, and no longer contains `sg-admin-eyebrow`. Continue asserting all existing canvas controls and inspector field labels. Assert the four canvas/node/inspector/player source files do not import Oxygen design packages.

- [ ] **Step 2: Run the workflow test and verify RED**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts`

Expected: FAIL because the outer workbench still uses `sg-admin-eyebrow` and raw header buttons.

- [ ] **Step 3: Replace the workflow outer header**

Import:

```tsx
import { PageHeader } from '@oxygen-design/patterns'
import { Badge, Button } from '@oxygen-design/ui'
```

Render `PageHeader` with `title="流程工作台"` and the existing description. Put the edit/preview/run controls into a `role="group" aria-label="工作模式"` container using Oxygen `Button` variants. Use `variant="secondary"` for active mode and `variant="ghost"` for inactive modes. Render normal save state as a `Badge`; render save failures with an Oxygen `Button variant="link"` that calls the existing retry coordinator.

Keep the nested `WorkflowSidebar`, canvas shell, `WorkflowCanvas`, `WorkflowPlayer`, `WorkflowInspector`, runtime handlers, persistence coordinators, and selected-node behavior unchanged.

- [ ] **Step 4: Add workflow outer adapter styles**

Add:

```css
.sg-workflow-page .oxygen-page-header {
  align-items: flex-end;
}

.sg-workflow-header__actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--oxygen-space-2);
}

.sg-workflow-mode-switch {
  display: inline-flex;
  gap: var(--oxygen-space-1);
}

.sg-workflow-status {
  color: var(--oxygen-color-text-muted);
  font-size: var(--oxygen-font-size-caption);
}
```

Retain the existing `.sg-workflow-*` rules that style the excluded canvas and node components. Update only the obsolete outer header selectors created by this task.

- [ ] **Step 5: Run focused admin tests**

Run:

```bash
pnpm exec vitest run \
  src/components/admin/AdminShell.test.ts \
  src/components/admin/AdminDataTable.test.ts \
  src/components/admin/KnowledgeWorkbench.test.ts \
  src/components/admin/WorkflowWorkbench.test.ts \
  src/app/admin/page.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run repository quality gates**

Run in order:

```bash
pnpm lint
pnpm typecheck
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 7: Run meaningful browser verification when the app is available**

Run:

```bash
pnpm test:e2e -- e2e/admin-workbench.spec.ts e2e/admin-workflows.spec.ts
```

Expected: PASS. If authentication or required environment variables prevent the admin route from rendering, report that limitation with the exact command output and use focused tests as the available evidence.

- [ ] **Step 8: Inspect final diff**

Run:

```bash
git status --short
git diff -- src/app/admin src/components/admin src/app/globals.css docs/superpowers
```

Expected: task changes are present; pre-existing workflow, SQL, asset, package, and test-result changes are preserved without unrelated rewrites.
