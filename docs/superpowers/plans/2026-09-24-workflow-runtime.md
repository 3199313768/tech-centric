# Workflow Runtime 第二阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `/admin/workflows` 画布上增加可恢复的流程播放器，支持人工输入、确认、选择和判断分支，并把运行快照持久化到 Supabase 账号元数据。

**Architecture:** 运行器是独立于 React 和 Supabase 的纯 TypeScript 状态机，读取现有 `WorkflowDocument`，按端口和边推进，遇到人工节点返回等待状态，遇到未接入的外部节点返回明确阻断。客户端新增播放器区域并通过独立的 `workflow_runs` metadata 防抖保存运行状态，与 `workflow_canvas` 画布保存完全分离。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript strict、Supabase SSR/Auth metadata、lucide-react、现有 `sg-*` token、Vitest、Playwright。

## Global Constraints

- 只改 Workflow 相关文件；保留现有 `/admin/settings` 和其他未提交改动。
- Server Component 默认优先；运行器纯函数不得依赖 React、Supabase 或浏览器 API。
- 禁止 `any`、无说明 `@ts-ignore`、`alert` 和浏览器 `localStorage` 持久化。
- 所有 Supabase `{ data, error }` 结果都必须分支处理；错误使用行内状态或 `role="alert"` 展示。
- 运行数据只能写入当前用户 `user_metadata.workflow_runs`；不得写入密钥、JWT、API Key 或 Supabase service role 信息。
- 画布只写 `user_metadata.workflow_canvas`；运行保存不能覆盖画布 metadata。
- 样式优先复用现有 `sg-*` 类和 `var(--sg-*)` token，新增布局不得产生横向溢出或文字重叠。
- 判断节点第一版只允许人工选择“是/否”，不实现表达式求值。
- AI、HTTP/API、数据库、文件、Webhook 等外部能力只显示明确阻断，不伪造执行结果。
- 每个任务先写失败测试或纯函数测试，再写最小实现；每个任务结束运行定向验证。

## Files And Responsibilities

- Modify: `src/lib/workflows/types.ts` — 增加运行值、等待状态、运行记录和运行 metadata 类型。
- Create: `src/lib/workflows/runtime.ts` — `startWorkflow`、`advanceWorkflow`、`resolveWaiting`、`cancelWorkflow`、`getRunProgress` 纯函数。
- Create: `src/lib/workflows/runtime.test.ts` — 运行器状态转移、人工暂停、人工分支、失败和步数上限测试。
- Create: `src/lib/workflows/runs.ts` — 运行 metadata 归一化、历史裁剪和当前流程引用校验。
- Create: `src/lib/workflows/runs.test.ts` — 坏数据回退、有限历史和不可恢复运行测试。
- Create: `src/lib/workflows/runPersistence.ts` — 运行快照防抖保存协调器，复用第一阶段的竞态保护模式。
- Create: `src/lib/workflows/runPersistence.test.ts` — 旧请求保护、失败重试和 dispose 测试。
- Create: `src/components/admin/workflows/WorkflowPlayer.tsx` — 运行播放器、人工等待控件、进度、恢复和取消操作。
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx` — 读取/保存 `workflow_runs`，在运行模式挂载播放器，保持编辑/预览状态独立。
- Modify: `src/app/admin/workflows/page.tsx` — 归一化并传递 `user_metadata.workflow_runs`。
- Modify: `src/components/admin/WorkflowWorkbench.test.ts` — 增加播放器挂载与独立 metadata 字段源码契约。
- Create: `src/components/admin/workflows/WorkflowPlayer.test.ts` — 播放器文案、控件和错误状态源码契约。
- Modify: `src/app/globals.css` — 新增最小 `sg-workflow-player-*` 样式和响应式规则。
- Modify: `e2e/admin-workflows.spec.ts` — 增加人工输入暂停、选择恢复和取消的管理员流程。

### Task 1: 运行类型与 metadata 归一化

**Files:**
- Modify: `src/lib/workflows/types.ts`
- Create: `src/lib/workflows/runs.ts`
- Test: `src/lib/workflows/runs.test.ts`

**Interfaces:**
- Produces `WorkflowValue = string | number | boolean | null` and `WorkflowValueMap = Record<string, WorkflowValue>`.
- Produces `WorkflowRunStatus`, `WorkflowWaitingState`, `WorkflowRunHistoryItem`, `WorkflowRun`, and `WorkflowRunMetadata` matching the approved specification.
- Produces `normalizeWorkflowRuns(input: unknown, workflows: WorkflowDocument[]): WorkflowRunMetadata` that never throws.
- Produces `saveWorkflowRuns(metadata: WorkflowRunMetadata, nextRun: WorkflowRun, maxRuns?: number): WorkflowRunMetadata` that upserts the run, updates `activeRunId`, and keeps active/waiting runs before bounded history.
- Produces `getRecoverableRun(metadata, workflowId): WorkflowRun | null` that returns only `running` or `waiting` runs whose current node exists in the selected workflow.

- [ ] **Step 1: Write failing normalization tests**

Create a small valid workflow fixture using `createEmptyWorkflow` and `addNode`, then cover malformed metadata, invalid status, missing node references, and history truncation:

```ts
it('falls back to empty run metadata for malformed input', () => {
  const result = normalizeWorkflowRuns({ runs: 'bad' }, [workflow])
  expect(result).toEqual({ version: 1, activeRunId: null, runs: [] })
})

it('keeps recoverable waiting runs and drops missing-node runs', () => {
  const result = normalizeWorkflowRuns({ version: 1, activeRunId: 'run-1', runs: [waitingRun, { ...waitingRun, id: 'run-2', currentNodeId: 'missing' }] }, [workflow])
  expect(result.activeRunId).toBe('run-1')
  expect(result.runs.map((run) => run.id)).toEqual(['run-1'])
})

it('retains active runs before bounded completed history', () => {
  const result = saveWorkflowRuns({ version: 1, activeRunId: null, runs: completedRuns }, waitingRun, 3)
  expect(result.runs).toHaveLength(3)
  expect(result.runs[0].status).toBe('waiting')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run src/lib/workflows/runs.test.ts`

Expected: FAIL because run types and normalization functions are not defined.

- [ ] **Step 3: Implement typed run metadata helpers**

Add explicit unions for run status and waiting kind. Normalize only plain objects, safe primitive values, finite timestamps, existing workflow IDs and existing node IDs. Treat malformed input as empty metadata. Keep at most 20 runs by default, sort active/waiting first, then newest `updatedAt`, and set `activeRunId` to `null` when its run was removed.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm exec vitest run src/lib/workflows/runs.test.ts`

Expected: all run metadata tests PASS.

- [ ] **Step 5: Commit the run model**

```bash
git add src/lib/workflows/types.ts src/lib/workflows/runs.ts src/lib/workflows/runs.test.ts
git commit -m "feat: add workflow run metadata model"
```

### Task 2: Pure workflow runtime state machine

**Files:**
- Create: `src/lib/workflows/runtime.ts`
- Test: `src/lib/workflows/runtime.test.ts`

**Interfaces:**
- Consumes `WorkflowDocument`, graph ports/edges, and run types from Task 1.
- Produces `startWorkflow(workflow: WorkflowDocument, inputs: WorkflowValueMap): WorkflowRun`.
- Produces `advanceWorkflow(run: WorkflowRun, workflow: WorkflowDocument, maxSteps?: number): WorkflowRun`.
- Produces `resolveWaiting(run: WorkflowRun, response: WorkflowValue): WorkflowRun`.
- Produces `cancelWorkflow(run: WorkflowRun): WorkflowRun`.
- Produces `getRunProgress(run: WorkflowRun, workflow: WorkflowDocument): { completed: number; total: number; currentTitle: string | null }`.

- [ ] **Step 1: Write failing runtime tests**

Build a linear fixture with `start -> human/input -> human/confirm -> human/select -> end` and a decision fixture whose ports are `yes` and `no`:

```ts
it('pauses at an input node and resumes with a typed value', () => {
  const started = startWorkflow(workflow, { topic: 'release' })
  const waiting = advanceWorkflow(started, workflow)
  expect(waiting.status).toBe('waiting')
  expect(waiting.waiting?.kind).toBe('input')

  const resumed = advanceWorkflow(resolveWaiting(waiting, 'approved'), workflow)
  expect(resumed.status).toBe('completed')
  expect(resumed.variables).toMatchObject({ response: 'approved' })
})

it('uses the selected yes/no output for a decision node', () => {
  const waiting = advanceWorkflow(startWorkflow(decisionWorkflow, {}), decisionWorkflow)
  const next = advanceWorkflow(resolveWaiting(waiting, 'yes'), decisionWorkflow)
  expect(next.currentNodeId).toBe('yes-target')
})

it('blocks external providers without making a network call', () => {
  const result = advanceWorkflow(startWorkflow(externalWorkflow, {}), externalWorkflow)
  expect(result.status).toBe('failed')
  expect(result.error).toContain('第三阶段')
})

it('fails a cycle after the step limit', () => {
  const result = advanceWorkflow(startWorkflow(cyclicWorkflow, {}), cyclicWorkflow, 3)
  expect(result.status).toBe('failed')
  expect(result.error).toContain('步数')
})
```

- [ ] **Step 2: Run tests to verify the expected failures**

Run: `pnpm exec vitest run src/lib/workflows/runtime.test.ts`

Expected: FAIL with missing runtime functions.

- [ ] **Step 3: Implement start and deterministic advancement**

Validate `settings.entryNodeId` in `startWorkflow`; initialize `running`, empty variables, empty history, and timestamps. In `advanceWorkflow`, find the current node, append completed history for directly passable manual nodes, create `waiting` state for human subtypes `input`, `confirm`, and `select`, and create fixed `yes`/`no` options for `control/decision`. Select the next edge by output port, treat no outgoing edge as `completed`, and return a failure with the node title for external providers or invalid graph references.

- [ ] **Step 4: Implement response validation and cancellation**

`resolveWaiting` must reject non-waiting runs and unsupported response types by returning an unchanged run with a clear error state. For valid responses, write a named value into `variables`, append the waiting history item, set the selected output port for the next advance, and return to `running`. `cancelWorkflow` must preserve history and return `cancelled`; `getRunProgress` must count unique completed history nodes and never divide by zero.

- [ ] **Step 5: Run focused runtime tests**

Run: `pnpm exec vitest run src/lib/workflows/runtime.test.ts`

Expected: all runtime tests PASS.

- [ ] **Step 6: Commit the runtime engine**

```bash
git add src/lib/workflows/runtime.ts src/lib/workflows/runtime.test.ts
git commit -m "feat: add workflow runtime state machine"
```

### Task 3: Runtime snapshot persistence

**Files:**
- Create: `src/lib/workflows/runPersistence.ts`
- Test: `src/lib/workflows/runPersistence.test.ts`

**Interfaces:**
- Consumes `WorkflowRunMetadata` and the existing persistence coordinator conventions.
- Produces `createWorkflowRunSaveCoordinator(save, delayMs?, onStateChange?)` with `schedule`, `retry`, `flush`, `dispose`, `getState`.
- `save` receives the complete normalized `WorkflowRunMetadata` and returns `{ error: Error | null }`.
- State is `{ pending: boolean; error: Error | null }` and old requests cannot overwrite newer metadata.

- [ ] **Step 1: Write failing persistence tests**

Cover debounced writes, failed writes retaining the newest snapshot, retry, and an older promise resolving after a newer write:

```ts
it('does not let an older write clear the pending newer snapshot', async () => {
  const resolvers: Array<(value: { error: Error | null }) => void> = []
  const save = vi.fn(() => new Promise<{ error: Error | null }>((resolve) => resolvers.push(resolve)))
  const coordinator = createWorkflowRunSaveCoordinator(save, 0)
  coordinator.schedule(firstMetadata)
  coordinator.schedule(secondMetadata)
  await coordinator.flush()
  resolvers[0]({ error: null })
  resolvers[1]({ error: null })
  expect(coordinator.getState()).toEqual({ pending: false, error: null })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run src/lib/workflows/runPersistence.test.ts`

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 3: Implement the coordinator**

Use a monotonically increasing request sequence and a queued latest metadata snapshot. Debounce writes, expose `flush` for page transitions, keep the latest snapshot after failure, and make `dispose` stop timers without cancelling an in-flight request. `retry` resubmits the latest failed snapshot.

- [ ] **Step 4: Run the focused test and commit**

Run: `pnpm exec vitest run src/lib/workflows/runPersistence.test.ts`

Expected: all persistence tests PASS.

```bash
git add src/lib/workflows/runPersistence.ts src/lib/workflows/runPersistence.test.ts
git commit -m "feat: persist workflow run snapshots safely"
```

### Task 4: Server adapter and workbench integration

**Files:**
- Modify: `src/app/admin/workflows/page.tsx`
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx`
- Modify: `src/components/admin/WorkflowWorkbench.test.ts`

**Interfaces:**
- `AdminWorkflowsPage` passes `initialRuns: WorkflowRunMetadata` alongside `initialMetadata` and `userId`.
- `WorkflowWorkbench` owns `runMetadata`, selected run, and mode-independent run state; it calls `createClient().auth.updateUser({ data: { workflow_runs: nextRuns } })` through the run coordinator.

- [ ] **Step 1: Extend source tests before implementation**

Add assertions that the server page calls `normalizeWorkflowRuns(user.user_metadata?.workflow_runs, initialMetadata.workflows)`, that the workbench accepts `initialRuns`, and that the save payload contains `workflow_runs` separately from `workflow_canvas`.

- [ ] **Step 2: Run source tests to verify the expected failures**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts`

Expected: FAIL because the server prop and run metadata integration are absent.

- [ ] **Step 3: Add server normalization**

Normalize canvas first, then normalize runs against the resulting workflow list. Pass both normalized values to the client. If the user is absent, preserve the existing `return null` behavior.

- [ ] **Step 4: Add independent run state and persistence**

Keep the existing canvas reducer and save coordinator unchanged. Add a separate run reducer/ref and `createWorkflowRunSaveCoordinator`; on every runtime transition call `saveWorkflowRuns`, update local state optimistically, and write only `{ workflow_runs: nextRuns }`. Load the recoverable `activeRunId` when entering run mode for the active workflow.

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts src/lib/workflows`

Expected: all workflow domain and workbench source tests PASS.

```bash
git add src/app/admin/workflows/page.tsx src/components/admin/workflows/WorkflowWorkbench.tsx src/components/admin/WorkflowWorkbench.test.ts
git commit -m "feat: integrate workflow runs into admin workbench"
```

### Task 5: Workflow player UI and human controls

**Files:**
- Create: `src/components/admin/workflows/WorkflowPlayer.tsx`
- Create: `src/components/admin/workflows/WorkflowPlayer.test.ts`
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx`

**Interfaces:**
- `WorkflowPlayer` props: `{ workflow: WorkflowDocument; run: WorkflowRun | null; recoverableRuns: WorkflowRun[]; onStart(inputs: WorkflowValueMap): void; onResolve(response: WorkflowValue): void; onResume(runId: string): void; onCancel(): void; onRetrySave(): void; saveError: Error | null }`.
- It renders no editor mutation controls and communicates only through typed callbacks.

- [ ] **Step 1: Write failing player contract tests**

Assert source/DOM contracts for visible `开始运行`, `继续运行`, `恢复运行`, `取消运行`, input submission, confirm actions, “是/否” options, progress status, and `role="alert"` error output. Assert no `window.prompt` or `alert` appears.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run src/components/admin/workflows/WorkflowPlayer.test.ts`

Expected: FAIL because the player component does not exist.

- [ ] **Step 3: Implement the player states**

Render an empty state with `开始运行`; render recoverable run summaries with `恢复运行`; render waiting input with a controlled field keyed to the waiting node; render confirm buttons; render select buttons with configured options or fixed “是/否”. Disable duplicate submissions while the workbench is saving, show status/error text inline, and keep the latest response in component state until the parent confirms persistence.

- [ ] **Step 4: Mount player in run mode**

In `WorkflowWorkbench`, render the player in the run surface and leave the canvas read-only. `onStart` creates a run and calls `advanceWorkflow`; `onResolve` calls `resolveWaiting` then `advanceWorkflow`; `onResume` loads the selected run without resetting it; `onCancel` calls `cancelWorkflow`. Save each resulting metadata snapshot through the independent coordinator.

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm exec vitest run src/components/admin/workflows/WorkflowPlayer.test.ts src/components/admin/WorkflowWorkbench.test.ts src/lib/workflows`

Expected: all player, workbench and runtime tests PASS.

```bash
git add src/components/admin/workflows/WorkflowPlayer.tsx src/components/admin/workflows/WorkflowPlayer.test.ts src/components/admin/workflows/WorkflowWorkbench.tsx src/components/admin/WorkflowWorkbench.test.ts
git commit -m "feat: add workflow player for human steps"
```

### Task 6: Responsive styling and browser acceptance

**Files:**
- Modify: `src/app/globals.css`
- Modify: `e2e/admin-workflows.spec.ts`

**Interfaces:**
- Produces visually stable `sg-workflow-player-*` styles for desktop and mobile without changing existing canvas token names.
- Extends the admin workflow E2E scenario with human waiting and resume behavior.

- [ ] **Step 1: Add a browser scenario that exercises the approved flow**

Add an authenticated test that opens `/admin/workflows`, enters run mode, starts a workflow containing an input node, verifies a waiting control, submits a value, verifies the next confirmation/selection state, cancels or completes, and checks the status region. Keep the test independent from external AI/API providers.

- [ ] **Step 2: Implement player CSS**

Add only `sg-workflow-player`, `sg-workflow-player__progress`, `sg-workflow-player__waiting`, `sg-workflow-player__error`, and control classes. Use existing color variables and `color-mix`; provide a single-column mobile layout, full-width controls, minimum touch targets, and wrapping text so node titles never overlap buttons.

- [ ] **Step 3: Run static and focused validation**

Run:

```bash
pnpm exec vitest run src/lib/workflows src/components/admin/WorkflowPlayer.test.ts src/components/admin/WorkflowWorkbench.test.ts src/components/admin/AdminShell.test.ts
pnpm exec eslint src/lib/workflows src/components/admin/workflows/WorkflowPlayer.tsx src/components/admin/workflows/WorkflowWorkbench.tsx src/app/admin/workflows/page.tsx
git diff --check
```

Expected: targeted tests pass, ESLint reports zero errors, and diff check is clean.

- [ ] **Step 4: Run browser acceptance and record environment limits**

Run: `pnpm exec playwright test e2e/admin-workflows.spec.ts`

Expected: authenticated workflow acceptance passes when browser bootstrap and session are available. If Chromium remains blocked by the environment or the app redirects to login, report the exact blocker as unverified rather than treating it as a product failure.

- [ ] **Step 5: Commit styling and E2E changes**

```bash
git add src/app/globals.css e2e/admin-workflows.spec.ts
git commit -m "test: cover workflow player acceptance"
```

### Task 7: Verification checkpoint

**Files:**
- No source changes unless a focused verification exposes a defect.

- [ ] **Step 1: Run TypeScript and build checks**

Run `pnpm typecheck` and `pnpm build`. Separate new Workflow errors from existing baseline failures in the report; do not claim a green full check if unrelated known failures remain.

- [ ] **Step 2: Run the full unit suite**

Run `pnpm test:unit`. Record total passed/failed files and identify whether failures are in Workflow code or existing modules.

- [ ] **Step 3: Inspect the final diff**

Run `git diff --check` and `git status --short`. Confirm only the intended Workflow files and the phase-two spec/plan commits changed; do not revert unrelated dirty files.

- [ ] **Step 4: Produce the handoff evidence**

Report targeted unit tests, lint, typecheck, build, browser, and real Supabase metadata evidence as separate categories. State any environment blockers and list the commit hashes created by the implementation tasks.

