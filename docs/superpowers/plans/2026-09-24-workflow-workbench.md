# Workflow 工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理端增加一个跨设备持久化的多流程无限画布，将可视化思维节点组织成可预览、可配置的统一 Workflow 模型。

**Architecture:** Server Component 在 `/admin/workflows` 读取并归一化当前 super admin 的 `user_metadata.workflow_canvas`，Client Component 通过纯 reducer/图操作函数管理流程、节点、连线和画布视口。客户端使用 Supabase Auth metadata 做防抖乐观保存；真实 AI/API 执行不在本阶段接入，但节点配置和运行阻断契约保留。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript strict、Supabase SSR/Auth metadata、lucide-react、现有 `sg-*` 设计 token、Vitest、Playwright。

## Global Constraints

- 只改 Workflow 相关文件和管理端导航；保留现有 `/admin/settings` 与其他未提交改动。
- Server Component 默认优先；只有画布交互、键盘和 Supabase browser client 所在组件使用 `'use client'`。
- 禁止 `any`、无说明 `@ts-ignore`、`alert` 和浏览器 `localStorage` 持久化。
- 所有 `{ data, error }` 结果都要分支处理；错误使用 `sg-*-error` 或页面内状态。
- 流程数据只能写入 `user_metadata.workflow_canvas`；不得写入密钥、JWT、API Key 或 Supabase service role 信息。
- 样式只使用现有 `sg-*` 类和 `var(--sg-*)` token；新增桌面/移动布局必须避免横向溢出和文字重叠。
- 第一阶段只提供节点配置、预览和运行阻断提示，不声称真实 AI/API 已执行。
- 每个实现任务先写可失败测试或纯函数测试，再写最小实现；完成前运行定向测试、TypeScript、lint、构建和可用的浏览器检查。

## Files And Responsibilities

- Create: `src/lib/workflows/types.ts` — Workflow metadata、document、node、port、edge 和枚举类型。
- Create: `src/lib/workflows/normalize.ts` — 不可信 metadata 的版本检查、默认值和引用清理。
- Create: `src/lib/workflows/normalize.test.ts` — 归一化、坏数据回退、未知节点处理测试。
- Create: `src/lib/workflows/graph.ts` — 创建流程/节点/边、复制流程、删除引用、连接约束和模式状态纯函数。
- Create: `src/lib/workflows/graph.test.ts` — 图操作的失败测试与回归测试。
- Create: `src/lib/workflows/persistence.ts` — 防抖保存状态机和递增请求序号的纯逻辑接口。
- Create: `src/lib/workflows/persistence.test.ts` — 旧请求不覆盖新请求、失败重试状态测试。
- Modify: `src/components/admin/AdminShell.tsx` — 新增 `/admin/workflows` 导航项及图标。
- Modify: `src/components/admin/AdminShell.test.ts` — 断言原导航保留并包含 Workflow 入口。
- Create: `src/app/admin/workflows/page.tsx` — Server Component，读取当前用户 metadata 并渲染客户端工作台。
- Create: `src/components/admin/workflows/WorkflowWorkbench.tsx` — 客户端总控：流程切换、模式、保存状态和快捷键。
- Create: `src/components/admin/workflows/WorkflowSidebar.tsx` — 流程列表与节点分组拖放入口。
- Create: `src/components/admin/workflows/WorkflowCanvas.tsx` — 网格画布、平移/缩放、节点移动、框选和连线交互。
- Create: `src/components/admin/workflows/WorkflowNode.tsx` — 节点卡片、锚点、双击标题编辑和选中态。
- Create: `src/components/admin/workflows/WorkflowInspector.tsx` — 右侧基础/思维/执行属性编辑和未配置阻断提示。
- Create: `src/components/admin/workflows/WorkflowWorkbench.test.ts` — 源码级结构与 aria 契约测试。
- Modify: `src/app/globals.css` — 仅新增 `sg-workflow-*` 样式与移动端断点。
- Create: `e2e/admin-workflows.spec.ts` — 管理员会话下的有限浏览器验收。

### Task 1: Workflow 类型与 metadata 归一化

**Files:**
- Create: `src/lib/workflows/types.ts`
- Create: `src/lib/workflows/normalize.ts`
- Test: `src/lib/workflows/normalize.test.ts`

**Interfaces:**
- Produces `WorkflowCanvasMetadata`, `WorkflowDocument`, `WorkflowNode`, `WorkflowEdge`, `WorkflowPort`, `WorkflowVariable` 类型。
- Produces `normalizeWorkflowCanvas(input: unknown): WorkflowCanvasMetadata`，永不抛出异常；坏数据返回一个空的可编辑流程。
- Produces `createEmptyWorkflow(name?: string): WorkflowDocument`，入口节点为空、视口为 `{ x: 0, y: 0, zoom: 1 }`。

- [ ] **Step 1: Write failing normalization tests**

Define the test fixture in `normalize.test.ts` before the tests:

```ts
const fixtureWorkflow: WorkflowDocument = {
  version: 1,
  id: 'flow-1',
  name: 'Fixture',
  description: '',
  inputs: [],
  variables: [],
  nodes: [{
    id: 'n1', kind: 'thinking', subtype: 'question', position: { x: 0, y: 0 },
    title: 'Question', description: '', color: 'green', config: {},
    inputs: [], outputs: [{ id: 'out', name: '下一步', dataType: 'text' }],
    execution: { mode: 'manual' },
  }],
  edges: [],
  settings: { entryNodeId: 'n1', errorPolicy: 'stop' },
  viewport: { x: 0, y: 0, zoom: 1 },
  updatedAt: '2026-09-24T00:00:00.000Z',
}
```

```ts
it('returns an empty editable workflow for malformed metadata', () => {
  const result = normalizeWorkflowCanvas({ workflows: [{ id: 1, nodes: 'bad' }] })
  expect(result.version).toBe(1)
  expect(result.workflows).toHaveLength(1)
  expect(result.workflows[0].nodes).toEqual([])
})

it('removes edges that reference missing nodes or ports', () => {
  const result = normalizeWorkflowCanvas({
    version: 1,
    activeWorkflowId: 'flow-1',
    workflows: [{ ...fixtureWorkflow, edges: [{ id: 'e', source: { nodeId: 'missing', portId: 'out' }, target: { nodeId: 'n1', portId: 'in' } }] }],
  })
  expect(result.workflows[0].edges).toEqual([])
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run src/lib/workflows/normalize.test.ts`

Expected: FAIL because workflow types and normalization functions do not exist.

- [ ] **Step 3: Implement the minimal typed model and normalizer**

Define explicit string unions for `kind`, `execution.mode`, `provider`, colors, and `errorPolicy`. Define `WorkflowPort` as `{ id: string; name: string; dataType: 'text' | 'number' | 'boolean' | 'json'; required?: boolean; description?: string }`, `WorkflowPortRef` as `{ nodeId: string; portId: string }`, and `WorkflowVariable` as `{ id: string; name: string; dataType: WorkflowPort['dataType']; value?: string }`. Normalize only plain objects, generate a fallback ID with `crypto.randomUUID()` when available, clamp zoom to `0.35..2`, preserve safe text fields, create default ports per subtype, and retain only edges whose node and port references resolve.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm exec vitest run src/lib/workflows/normalize.test.ts`

Expected: all normalization tests PASS.

- [ ] **Step 5: Commit the isolated domain model**

```bash
git add src/lib/workflows/types.ts src/lib/workflows/normalize.ts src/lib/workflows/normalize.test.ts
git commit -m "feat: add workflow document normalization"
```

### Task 2: Pure graph mutations and mode rules

**Files:**
- Create: `src/lib/workflows/graph.ts`
- Test: `src/lib/workflows/graph.test.ts`

**Interfaces:**
- Consumes types and defaults from Task 1.
- Produces `addNode(workflow, input: { kind: WorkflowNode['kind']; subtype: string; title?: string; position: { x: number; y: number } }): WorkflowDocument`, `moveNodes(workflow, nodeIds: string[], delta: { x: number; y: number }): WorkflowDocument`, `updateNode(workflow, nodeId: string, patch: Partial<Pick<WorkflowNode, 'title' | 'description' | 'color' | 'config' | 'execution'>>): WorkflowDocument`, `removeNodes(workflow, nodeIds: string[]): WorkflowDocument`, `addEdge(workflow, source: WorkflowPortRef, target: WorkflowPortRef, condition?: WorkflowEdge['condition']): WorkflowDocument`, `removeEdge(workflow, edgeId: string): WorkflowDocument`, `duplicateWorkflow(workflow: WorkflowDocument): WorkflowDocument`, `createWorkflow(name?: string): WorkflowDocument`, and `getRunBlockReason(workflow: WorkflowDocument): string | null`.

- [ ] **Step 1: Write failing graph-operation tests**

At the top of `graph.test.ts`, create a disabled fixture with the public helpers so the test does not depend on production object literals:

```ts
const first = addNode(createWorkflow('Fixture'), { kind: 'thinking', subtype: 'question', title: 'Question', position: { x: 0, y: 0 } })
const fixtureWorkflow = updateNode(first, first.nodes[0].id, { execution: { mode: 'disabled' } })
```

```ts
it('creates an edge only when source and target ports exist', () => {
  const withTarget = addNode(fixtureWorkflow, { kind: 'thinking', subtype: 'analysis', title: 'Analysis', position: { x: 160, y: 0 } })
  const targetId = withTarget.nodes[1].id
  const next = addEdge(withTarget, { nodeId: 'n1', portId: 'out' }, { nodeId: targetId, portId: 'in' })
  expect(next.edges).toHaveLength(1)
  expect(addEdge(next, { nodeId: 'missing', portId: 'out' }, { nodeId: targetId, portId: 'in' })).toEqual(next)
})

it('blocks run mode when a node is not configured', () => {
  expect(getRunBlockReason(fixtureWorkflow)).toContain('尚未配置')
})
```

- [ ] **Step 2: Run tests to verify the expected failures**

Run: `pnpm exec vitest run src/lib/workflows/graph.test.ts`

Expected: FAIL with missing graph functions.

- [ ] **Step 3: Implement immutable graph helpers**

Return new workflow objects for every mutation. Reject self-links, duplicate edges, missing ports, and links from disabled nodes. `removeNodes` also removes incident edges. `duplicateWorkflow` creates new IDs for the flow, nodes, edges, and preserves relative positions. `getRunBlockReason` returns `null` only when every node is manual or configured; otherwise returns an actionable Chinese message.

- [ ] **Step 4: Run tests and keep them green**

Run: `pnpm exec vitest run src/lib/workflows/graph.test.ts`

Expected: all graph-operation tests PASS.

- [ ] **Step 5: Commit graph behavior**

```bash
git add src/lib/workflows/graph.ts src/lib/workflows/graph.test.ts
git commit -m "feat: add workflow graph mutations"
```

### Task 3: Navigation and server entry

**Files:**
- Modify: `src/components/admin/AdminShell.tsx`
- Modify: `src/components/admin/AdminShell.test.ts`
- Create: `src/app/admin/workflows/page.tsx`
- Create: `src/components/admin/WorkflowWorkbench.test.ts`

**Interfaces:**
- `AdminShell` exposes `/admin/workflows` using a `Workflow` icon while retaining `/admin/settings` and persisted navigation order behavior.
- `AdminWorkflowsPage` passes normalized `user.user_metadata.workflow_canvas` and the current user ID to `WorkflowWorkbench`.

- [ ] **Step 1: Extend navigation source test**

Update the test description from “keeps five navigation entries” to “keeps six navigation entries”. Add assertions for `href: '/admin/workflows'`, `label: '流程工作台'`, and the existing settings entry. Add a source assertion that the page calls `normalizeWorkflowCanvas` before rendering.

- [ ] **Step 2: Run the source tests and verify they fail**

Run: `pnpm exec vitest run src/components/admin/AdminShell.test.ts src/components/admin/WorkflowWorkbench.test.ts`

Expected: FAIL because the new href and page do not exist.

- [ ] **Step 3: Add the route and server adapter**

Use `requireSuperAdmin()` as existing admin pages do. Return `null` when no user is available. Normalize only metadata data and render the client workbench with `initialMetadata` and `userId`; do not add a separate API route. Add the Workflow navigation item to the fixed item list before the settings item so the existing persisted-order restoration still appends missing entries.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm exec vitest run src/components/admin/AdminShell.test.ts src/components/admin/WorkflowWorkbench.test.ts`

Expected: PASS for navigation and server entry source contracts.

- [ ] **Step 5: Commit route wiring**

```bash
git add src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.ts src/app/admin/workflows/page.tsx src/components/admin/WorkflowWorkbench.test.ts
git commit -m "feat: add admin workflow workbench route"
```

### Task 4: Client workbench shell, process list, and inspector

**Files:**
- Create: `src/components/admin/workflows/WorkflowWorkbench.tsx`
- Create: `src/components/admin/workflows/WorkflowSidebar.tsx`
- Create: `src/components/admin/workflows/WorkflowInspector.tsx`
- Modify: `src/components/admin/WorkflowWorkbench.test.ts`

**Interfaces:**
- `WorkflowWorkbench` accepts `{ initialMetadata: WorkflowCanvasMetadata; userId: string }` and owns active workflow, selected node, mode, dirty state, and save status.
- `WorkflowSidebar` receives workflows and callbacks for create, select, rename, duplicate, delete, and add-node.
- `WorkflowInspector` receives a selected node and emits typed `updateNode` patches.

- [ ] **Step 1: Add failing source/behavior contracts**

Assert that the workbench includes accessible controls named `编辑`, `预览`, `运行`, `新建空白流程`, `从模板开始`, `让 AI 生成流程`, and a visible save status region. Assert that the inspector exposes labels `名称`, `说明`, `类型`, `执行方式`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts`

Expected: FAIL because the client components do not exist.

- [ ] **Step 3: Implement the shell and sidebar**

Use `useReducer` around immutable graph helpers. The sidebar supports a controlled text input for renaming, confirmation-free create/duplicate, and an inline delete confirmation. Empty-state buttons create one real blank workflow; template/AI buttons set an explicit “第一阶段暂不可用” state. Keep keyboard access for all actions and expose `role="status"` for save state.

- [ ] **Step 4: Implement inspector editing**

Render only fields supported by the node kind. Update title/description/color with typed patches. Show execution mode as a select with `manual`, `configured`, and `disabled`; configured AI/API providers display a non-success informational state because no real executor is present.

- [ ] **Step 5: Run source tests and verify they pass**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts`

Expected: PASS for workbench controls and inspector contracts.

- [ ] **Step 6: Commit workbench shell**

```bash
git add src/components/admin/workflows src/components/admin/WorkflowWorkbench.test.ts
git commit -m "feat: add workflow sidebar and inspector"
```

### Task 5: Infinite canvas and node interactions

**Files:**
- Create: `src/components/admin/workflows/WorkflowCanvas.tsx`
- Create: `src/components/admin/workflows/WorkflowNode.tsx`
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx`
- Modify: `src/components/admin/WorkflowWorkbench.test.ts`

**Interfaces:**
- `WorkflowCanvas` receives the active workflow, selected IDs, mode, and graph callbacks; it emits `onViewportChange`, `onSelect`, `onMoveNodes`, `onConnect`, `onDelete`.
- `WorkflowNode` renders stable dimensions and four connection anchors with accessible labels.

- [ ] **Step 1: Add interaction contract tests**

Extend the source test to assert `aria-label` values for `画布`, `放大`, `缩小`, `适配画布`, `撤销`, `重做`, and node connection anchors. Assert that preview mode marks the canvas read-only and runtime mode renders the graph block reason.

- [ ] **Step 2: Run focused tests to verify the contracts fail**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts`

Expected: FAIL because the canvas components and labels are missing.

- [ ] **Step 3: Implement the canvas coordinate system**

Render a positioned inner canvas using the workflow viewport. Use pointer capture for pan and node drag, convert screen coordinates to canvas coordinates with the current zoom, clamp zoom to `0.35..2`, and preserve viewport changes in the active workflow. Use native pointer events and existing React APIs; do not add a new canvas library.

- [ ] **Step 4: Implement nodes, selection, multi-select, and delete**

Give every node a stable fixed width and minimum height. Support click, shift-click, marquee selection, double-click title editing, copy with `Mod/Ctrl+C`, paste with `Mod/Ctrl+V`, and Delete/Backspace. Disable mutations in preview mode.

- [ ] **Step 5: Implement edges and condition labels**

Draw SVG paths behind nodes. Start a connection from an output anchor and finalize only on a valid target input anchor; call `addEdge` so duplicate/self/missing-port constraints stay in the domain layer. For decision nodes, show default `是` and `否` output labels and allow edge label editing in the inspector.

- [ ] **Step 6: Run focused tests and verify they pass**

Run: `pnpm exec vitest run src/lib/workflows/graph.test.ts src/components/admin/WorkflowWorkbench.test.ts`

Expected: PASS for graph and canvas contracts.

- [ ] **Step 7: Commit canvas interactions**

```bash
git add src/components/admin/workflows src/components/admin/WorkflowWorkbench.test.ts
git commit -m "feat: add workflow canvas interactions"
```

### Task 6: Supabase metadata persistence

**Files:**
- Create: `src/lib/workflows/persistence.ts`
- Create: `src/lib/workflows/persistence.test.ts`
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx`

**Interfaces:**
- `createWorkflowSaveCoordinator(save: (metadata: WorkflowCanvasMetadata) => Promise<{ error: Error | null }>, delayMs?: number)` returns `schedule(metadata)`, `retry()`, `flush()`, `dispose()`, and `getState(): { pending: boolean; error: Error | null }`.

- [ ] **Step 1: Write failing save-coordinator tests**

```ts
it('does not let an older response clear a newer dirty state', async () => {
  const metadataA: WorkflowCanvasMetadata = { version: 1, activeWorkflowId: null, workflows: [] }
  const metadataB: WorkflowCanvasMetadata = { version: 1, activeWorkflowId: 'flow-b', workflows: [] }
  const requests: Array<(result: { error: Error | null }) => void> = []
  const coordinator = createWorkflowSaveCoordinator((_) => new Promise((resolve) => requests.push(resolve)), 0)
  coordinator.schedule(metadataA)
  coordinator.schedule(metadataB)
  await coordinator.flush()
  requests[0]({ error: null })
  expect(coordinator.getState().pending).toBe(true)
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm exec vitest run src/lib/workflows/persistence.test.ts`

Expected: FAIL because the coordinator is missing.

- [ ] **Step 3: Implement debounce and request sequencing**

Track the latest metadata snapshot, pending count, last error, and request sequence. `schedule` resets the timer; `flush` sends only the newest snapshot; stale responses cannot clear a newer pending state. `retry` resubmits the latest failed snapshot. `dispose` cancels timers and prevents post-unmount state changes.

- [ ] **Step 4: Connect the browser Supabase client**

In `WorkflowWorkbench`, call `createClient().auth.updateUser({ data: { workflow_canvas: metadata } })`, branch on `error`, and expose `保存中`, `已保存`, `保存失败，重试` in the status region. Keep the latest local graph if persistence fails.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `pnpm exec vitest run src/lib/workflows/persistence.test.ts src/lib/workflows/normalize.test.ts`

Expected: PASS with no unhandled promise warnings.

- [ ] **Step 6: Commit persistence**

```bash
git add src/lib/workflows/persistence.ts src/lib/workflows/persistence.test.ts src/components/admin/workflows/WorkflowWorkbench.tsx
git commit -m "feat: persist workflow metadata safely"
```

### Task 7: Styling, responsive behavior, and browser acceptance

**Files:**
- Modify: `src/app/globals.css`
- Create: `e2e/admin-workflows.spec.ts`

**Interfaces:**
- All new styles are prefixed `sg-workflow-` and use existing `--sg-*` variables.
- Browser test assumes an existing authenticated admin session; unauthenticated redirect is recorded as an environment limitation rather than bypassed.

- [ ] **Step 1: Add the browser acceptance test**

```ts
test('admin workflow workbench creates and edits a graph', async ({ page }) => {
  await page.goto('/admin/workflows')
  await expect(page.getByRole('heading', { name: '流程工作台' })).toBeVisible()
  await page.getByRole('button', { name: '新建空白流程' }).click()
  await expect(page.getByRole('status')).toContainText('已保存')
  await page.getByRole('button', { name: '步骤' }).dragTo(page.getByRole('application', { name: '流程画布' }))
  await expect(page.getByText('新节点')).toBeVisible()
})
```

- [ ] **Step 2: Run the browser test before styling and record the expected failure**

Run: `pnpm exec playwright test e2e/admin-workflows.spec.ts --project=chromium`

Expected: FAIL until the route and selectors exist; if login/session blocks it, record the redirect URL and keep the test unchanged.

- [ ] **Step 3: Add desktop and mobile `sg-workflow-*` styles**

Use a fixed-height workbench below the admin shell, CSS grid for three columns, `overflow: hidden` on the shell, explicit canvas dimensions, stable node dimensions, visible focus states, and bottom drawers below the existing mobile breakpoint. Update the admin mobile navigation grid from five to six columns so the new Workflow item remains reachable. Do not use gradients or hex colors.

- [ ] **Step 4: Run focused checks**

Run: `pnpm exec vitest run src/lib/workflows src/components/admin/AdminShell.test.ts src/components/admin/WorkflowWorkbench.test.ts && pnpm eslint src/lib/workflows src/components/admin src/app/admin/workflows/page.tsx && pnpm exec playwright test e2e/admin-workflows.spec.ts --project=chromium`

Expected: unit/source tests and lint pass; browser test passes with an authenticated session or reports the exact login/environment blocker.

- [ ] **Step 5: Run repository gates and inspect the diff**

Run: `pnpm typecheck && pnpm build && git diff --check`

Expected: TypeScript, production build, and whitespace checks pass; unrelated dirty files remain untouched.

- [ ] **Step 6: Commit the verified UI**

```bash
git add src/app/globals.css e2e/admin-workflows.spec.ts
git commit -m "feat: style and verify workflow workbench"
```

## Plan Self-Review

- Spec coverage: product positioning, first-phase scope, three-column desktop layout, mobile drawers, unified document model, metadata persistence, error handling, staged execution boundary, and verification evidence are covered by Tasks 1–7.
- Placeholder scan: no `TBD` or vague implementation steps; AI/template buttons are explicitly defined as first-phase unavailable states.
- Type consistency: Task 1 defines all domain types consumed by Tasks 2–6; graph/persistence signatures are named before use; route props match the workbench interface.
- Scope check: real execution, secrets, runs, collaboration, and versioning remain explicit non-goals and are not assigned implementation tasks.
