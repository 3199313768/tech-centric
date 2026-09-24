# Workflow AI Execution 第三阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Workflow 播放器中安全接入服务端 DeepSeek AI 节点，支持变量模板、结构化输出、受限条件表达式、重试和错误分支。

**Architecture:** 保持现有纯运行器负责图推进和人工节点；AI 节点由客户端标记为 `executing` 后调用受保护的 `/api/admin/workflows/execute` Route Handler。Route Handler 从当前 super admin 的 `workflow_canvas` 重新读取并校验节点配置，调用现有服务端 DeepSeek 客户端，客户端将经过限制的结果写回 `workflow_runs` 并继续图推进。模板插值和条件求值使用独立、无 `eval` 的纯函数模块。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript strict、Supabase SSR/Auth metadata、现有 `deepseekChatCompletion`、lucide-react、`sg-*` token、Vitest、Playwright。

## Global Constraints

- 只改 Workflow、AI 执行 Route Handler 和对应测试；保留其他未提交改动。
- AI provider 第一批固定为服务端 `deepseek`；HTTP/API、数据库、文件、Webhook 继续返回“后续阶段未启用”。
- 读取和保存使用 `user_metadata.workflow_canvas` 与 `user_metadata.workflow_runs` 两个独立字段；不得写入 API Key、JWT、Authorization header、完整 Prompt/响应或服务端堆栈。
- Route Handler 必须调用 `requireApiSuperAdmin()`，重新从当前用户 metadata 读取和归一化流程，不信任客户端上传的完整节点配置。
- 禁止 `eval`、`Function`、任意上游 URL、客户端密钥和 Mock 数据冒充 AI 成功。
- 所有 `{ data, error }`、网络异常、超时、JSON 解析异常都必须进入可见错误状态；禁止 `alert`。
- 新增 JSON 配置必须限制深度、键数、字符串长度、数组长度和总字节数。
- Server-only 模块不得被 Client Component 直接导入；浏览器只调用 Route Handler。
- 每个任务先写失败测试，再写最小实现；定向测试、类型检查、构建、浏览器和真实 DeepSeek 证据分开报告。

## Files And Responsibilities

- Modify: `src/lib/workflows/types.ts` — 增加安全 JSON 值、AI 配置、执行状态和执行尝试类型。
- Modify: `src/lib/workflows/normalize.ts` — 归一化嵌套配置与 AI 参数，兼容旧节点。
- Create: `src/lib/workflows/templates.ts` — `{{inputs.*}}`、`{{variables.*}}`、`{{nodes.*.output}}` 安全插值。
- Create: `src/lib/workflows/templates.test.ts` — 路径、缺失值、长度和越权测试。
- Create: `src/lib/workflows/conditions.ts` — 白名单 tokenizer/parser 和比较/逻辑求值。
- Create: `src/lib/workflows/conditions.test.ts` — 合法表达式、非法函数、越权路径和类型错误测试。
- Create: `src/lib/workflows/aiResult.ts` — AI text/JSON 输出解析、映射、大小限制和错误分类。
- Create: `src/lib/workflows/aiResult.test.ts` — 输出解析、变量映射和失败分类测试。
- Create: `src/lib/workflows/server/aiExecutor.ts` — server-only DeepSeek 执行器、超时、Abort、响应裁剪和 retryable 分类。
- Create: `src/lib/workflows/server/aiExecutor.test.ts` — mock DeepSeek 成功、无 key、超时、429/5xx、空响应和敏感字段过滤。
- Create: `src/app/api/admin/workflows/execute/route.ts` — super admin 鉴权、metadata 流程校验和安全响应。
- Create: `src/app/api/admin/workflows/execute/route.test.ts` — Route Handler 鉴权、篡改请求、执行成功和错误响应测试。
- Modify: `src/lib/workflows/runtime.ts` — 增加 AI 节点状态、`out/error` 出口和可恢复错误转换的纯状态边界。
- Create: `src/lib/workflows/executionClient.ts` — 浏览器调用执行 Route Handler 的 typed client，不包含密钥。
- Create: `src/lib/workflows/executionClient.test.ts` — 请求体白名单、响应错误和取消行为测试。
- Modify: `src/components/admin/workflows/WorkflowInspector.tsx` — AI Prompt、变量映射、输出格式、重试和超时配置控件。
- Modify: `src/components/admin/workflows/WorkflowPlayer.tsx` — executing/retrying/error、重试当前节点和错误分支交互。
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx` — async AI 执行编排、运行快照更新和旧响应保护。
- Modify: `src/components/admin/workflows/WorkflowPlayer.test.ts` — AI 状态与错误交互契约。
- Modify: `src/components/admin/WorkflowWorkbench.test.ts` — AI metadata、执行 client 和配置契约。
- Modify: `src/app/globals.css` — `sg-workflow-ai-*` 配置/执行状态样式。
- Modify: `e2e/admin-workflows.spec.ts` — 人工输入 → AI → 人工确认的浏览器流程，真实 key 不可用时验证安全错误。

### Task 1: Safe JSON and AI configuration model

**Files:**
- Modify: `src/lib/workflows/types.ts`
- Modify: `src/lib/workflows/normalize.ts`
- Create: `src/lib/workflows/normalize-ai.test.ts`

**Interfaces:**
- Produces `WorkflowJsonValue` and `WorkflowJsonObject` types with recursive safe JSON values.
- Produces `WorkflowAiConfig` with provider `deepseek`, prompt fields, temperature, response format, output variable, retry count and timeout.
- Extends `WorkflowNode.config` without breaking old primitive configs.
- Produces `normalizeWorkflowAiConfig(input: unknown): WorkflowAiConfig | null` with bounded defaults.

- [ ] **Step 1: Write failing configuration tests**

```ts
it('normalizes a bounded DeepSeek config', () => {
  expect(normalizeWorkflowAiConfig({
    provider: 'deepseek',
    promptTemplate: 'Summarize {{inputs.topic}}',
    temperature: 0.4,
    responseFormat: 'json',
    outputVariable: 'summary',
    maxRetries: 2,
    timeoutMs: 20_000,
  })).toMatchObject({ provider: 'deepseek', temperature: 0.4, maxRetries: 2 })
})

it('rejects client-side secrets and unbounded values', () => {
  expect(normalizeWorkflowAiConfig({ apiKey: 'secret', endpoint: 'https://evil.test', timeoutMs: 999_999 })).toBeNull()
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run src/lib/workflows/normalize-ai.test.ts`

Expected: FAIL because the recursive value type and AI normalizer do not exist.

- [ ] **Step 3: Implement safe recursive normalization**

Accept only JSON primitives, arrays and plain objects. Clamp `temperature` to `0..2`, `maxRetries` to `0..2`, `timeoutMs` to `5_000..60_000`, prompt/system strings to 8,000 characters, output variable to a safe identifier, and response format to `text | json`. Drop `apiKey`, `endpoint`, headers and unknown provider fields. Preserve old primitive node configs as-is.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm exec vitest run src/lib/workflows/normalize-ai.test.ts`

Expected: all configuration tests PASS.

```bash
git add src/lib/workflows/types.ts src/lib/workflows/normalize.ts src/lib/workflows/normalize-ai.test.ts
git commit -m "feat: add safe workflow ai configuration"
```

### Task 2: Safe templates, conditions and AI result mapping

**Files:**
- Create: `src/lib/workflows/templates.ts`
- Create: `src/lib/workflows/templates.test.ts`
- Create: `src/lib/workflows/conditions.ts`
- Create: `src/lib/workflows/conditions.test.ts`
- Create: `src/lib/workflows/aiResult.ts`
- Create: `src/lib/workflows/aiResult.test.ts`

**Interfaces:**
- `renderWorkflowTemplate(template: string, context: WorkflowExecutionContext): { ok: true; text: string } | { ok: false; error: string }`.
- `evaluateWorkflowCondition(expression: string, context: WorkflowExecutionContext): { ok: true; value: boolean } | { ok: false; error: string }`.
- `parseAiOutput(raw: string, format: 'text' | 'json'): { ok: true; value: WorkflowJsonValue } | { ok: false; error: string; retryable: false }`.
- `mapAiOutput(value: WorkflowJsonValue, outputVariable: string): WorkflowValueMap`.
- `WorkflowExecutionContext` contains only `inputs`, `variables`, and previous node outputs; no functions or request objects.

- [ ] **Step 1: Write failing template/condition/result tests**

```ts
it('renders only declared paths', () => {
  const result = renderWorkflowTemplate('主题：{{inputs.topic}} / {{variables.approved}}', {
    inputs: { topic: '发布' }, variables: { approved: true }, nodes: {},
  })
  expect(result).toEqual({ ok: true, text: '主题：发布 / true' })
})

it('rejects functions and undeclared paths', () => {
  expect(renderWorkflowTemplate('{{__proto__.x}}', context).ok).toBe(false)
  expect(evaluateWorkflowCondition('inputs.topic.includes("x")', context).ok).toBe(false)
})

it('parses bounded JSON output and rejects malformed JSON', () => {
  expect(parseAiOutput('{"score": 1}', 'json')).toEqual({ ok: true, value: { score: 1 } })
  expect(parseAiOutput('{bad', 'json')).toMatchObject({ ok: false, retryable: false })
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm exec vitest run src/lib/workflows/templates.test.ts src/lib/workflows/conditions.test.ts src/lib/workflows/aiResult.test.ts`

Expected: FAIL because the parser, evaluator and result mapper do not exist.

- [ ] **Step 3: Implement path-only template rendering**

Tokenize `{{path}}` tokens, allow only `inputs.<identifier>`, `variables.<identifier>`, and `nodes.<safe-id>.output`, stringify safe primitive/JSON values, reject missing paths, reject token count or rendered output over configured limits, and never execute source text.

- [ ] **Step 4: Implement the restricted condition parser**

Tokenize identifiers, string/number/boolean/null literals, parentheses and operators `== != > >= < <= && ||`. Parse with explicit precedence and resolve only the same execution context paths. Reject member calls, brackets, unknown identifiers, excessive nesting and trailing tokens.

- [ ] **Step 5: Implement AI output parsing and mapping**

Trim text output and enforce a maximum size. For JSON, parse only object/array values, enforce depth/key/array limits, and return non-retryable validation errors. Map the resulting safe value to the configured output variable without serializing secrets.

- [ ] **Step 6: Run focused tests and commit**

Run: `pnpm exec vitest run src/lib/workflows/templates.test.ts src/lib/workflows/conditions.test.ts src/lib/workflows/aiResult.test.ts`

Expected: all parser and result tests PASS.

```bash
git add src/lib/workflows/templates.ts src/lib/workflows/templates.test.ts src/lib/workflows/conditions.ts src/lib/workflows/conditions.test.ts src/lib/workflows/aiResult.ts src/lib/workflows/aiResult.test.ts
git commit -m "feat: add safe workflow templates and conditions"
```

### Task 3: Server-only DeepSeek executor

**Files:**
- Create: `src/lib/workflows/server/aiExecutor.ts`
- Create: `src/lib/workflows/server/aiExecutor.test.ts`

**Interfaces:**
- `executeWorkflowAi(input: ExecuteWorkflowAiInput): Promise<ExecuteWorkflowAiResult>`.
- Input contains normalized `WorkflowAiConfig`, rendered prompts, `AbortSignal`, and a request-scoped attempt number; it never contains a client API key.
- Result is either `{ ok: true; output: WorkflowJsonValue; usage: { inputChars: number; outputChars: number }; retryable: false }` or `{ ok: false; error: string; retryable: boolean; status?: number }`.
- Module begins with `import 'server-only'` and imports the existing `deepseekChatCompletion` implementation.

- [ ] **Step 1: Write failing executor tests with a mocked DeepSeek client**

Cover successful text/JSON calls, missing `DEEPSEEK_API_KEY`, abort/timeout, 429/5xx retryability, empty response and response truncation. Assert errors never include the API key or authorization header.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run src/lib/workflows/server/aiExecutor.test.ts`

Expected: FAIL because the server executor does not exist.

- [ ] **Step 3: Implement the server-only executor**

Call `deepseekChatCompletion` with the normalized system/user messages, temperature, response format and timeout signal. Classify network/timeout/429/5xx as retryable, classify missing key/config/JSON validation as non-retryable, cap returned output and usage, and convert all upstream errors to safe user-visible messages.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm exec vitest run src/lib/workflows/server/aiExecutor.test.ts`

Expected: all executor tests PASS.

```bash
git add src/lib/workflows/server/aiExecutor.ts src/lib/workflows/server/aiExecutor.test.ts
git commit -m "feat: execute workflow ai nodes server side"
```

### Task 4: Protected workflow execution Route Handler

**Files:**
- Create: `src/app/api/admin/workflows/execute/route.ts`
- Create: `src/app/api/admin/workflows/execute/route.test.ts`

**Interfaces:**
- `POST` accepts only `{ workflowId: string; runId: string; nodeId: string; inputs: WorkflowValueMap; variables: WorkflowValueMap; attempt: number }`.
- It returns `{ ok: true; output: WorkflowJsonValue; variables: WorkflowValueMap; usage: ...; retryable: false }` or `{ ok: false; error: string; retryable: boolean }` with an appropriate 400/401/403/409/429/500 status.
- It imports `requireApiSuperAdmin`, `normalizeWorkflowCanvas`, template rendering, result parsing and the server executor.

- [ ] **Step 1: Write failing route tests**

Mock auth and the DeepSeek executor. Assert unauthenticated access returns 401/403, malformed body returns 400, unknown workflow/node/provider returns 409, a valid configured AI node returns sanitized output, and a client-supplied endpoint/key is ignored or rejected.

- [ ] **Step 2: Run the route tests and verify they fail**

Run: `pnpm exec vitest run src/app/api/admin/workflows/execute/route.test.ts`

Expected: FAIL because the route and server contracts do not exist.

- [ ] **Step 3: Implement auth and metadata validation**

Use `requireApiSuperAdmin()`. Parse the bounded JSON body, read the authenticated user metadata with the server Supabase client, normalize the canvas, find the requested workflow/node, require `kind === 'ai'`, provider `deepseek`, and execution mode `configured`, then render prompts from the server-side workflow config and supplied safe values.

- [ ] **Step 4: Implement safe response mapping**

Call `executeWorkflowAi`, parse output according to the node config, map the configured output variable, and return only safe output/usage/retryability fields. Never include raw request, key, authorization, stack, or full upstream body.

- [ ] **Step 5: Run route tests and commit**

Run: `pnpm exec vitest run src/app/api/admin/workflows/execute/route.test.ts`

Expected: all route tests PASS.

```bash
git add src/app/api/admin/workflows/execute/route.ts src/app/api/admin/workflows/execute/route.test.ts
git commit -m "feat: add protected workflow ai route"
```

### Task 5: Client execution bridge and async runtime state

**Files:**
- Create: `src/lib/workflows/executionClient.ts`
- Create: `src/lib/workflows/executionClient.test.ts`
- Modify: `src/lib/workflows/types.ts`
- Modify: `src/lib/workflows/runtime.ts`
- Modify: `src/lib/workflows/runtime.test.ts`

**Interfaces:**
- `executeWorkflowNode(request: WorkflowExecutionRequest, signal?: AbortSignal): Promise<WorkflowExecutionResponse>` sends only the whitelisted request body to `/api/admin/workflows/execute`.
- `beginAiExecution(run, nodeId): WorkflowRun` sets `executionStatus: 'executing'` and `executionNodeId`.
- `completeAiExecution(run, result): WorkflowRun` writes safe output and returns to graph progression.
- `failAiExecution(run, error): WorkflowRun` records retryable state and exposes an error-branch decision.
- `retryAiExecution(run): WorkflowRun` increments attempt without replaying successful history.

- [ ] **Step 1: Write failing runtime/client tests**

Cover request body omission of unknown fields, executing state, successful output routing, retryable failure, max retry exhaustion, and `error` edge routing. Verify an older response cannot overwrite a newer attempt.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm exec vitest run src/lib/workflows/executionClient.test.ts src/lib/workflows/runtime.test.ts`

Expected: FAIL because the async execution state and client bridge do not exist.

- [ ] **Step 3: Implement the typed client**

Use `fetch('/api/admin/workflows/execute', { method: 'POST', ... })`, cap serialized body size, check `response.ok`, parse only the documented response union, and throw safe errors with `retryable` metadata. Connect an AbortController from the player to the request.

- [ ] **Step 4: Extend pure runtime state**

Add execution fields and output context without adding network calls to `runtime.ts`. For AI nodes, return an execution boundary; on success route through `out`, on failure route through `error` only when explicitly selected, otherwise keep a failed/resumable run. Enforce attempt and sequence checks.

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm exec vitest run src/lib/workflows/executionClient.test.ts src/lib/workflows/runtime.test.ts`

Expected: all async runtime boundary tests PASS.

```bash
git add src/lib/workflows/executionClient.ts src/lib/workflows/executionClient.test.ts src/lib/workflows/types.ts src/lib/workflows/runtime.ts src/lib/workflows/runtime.test.ts
git commit -m "feat: bridge workflow runtime to ai execution"
```

### Task 6: AI node inspector configuration

**Files:**
- Modify: `src/components/admin/workflows/WorkflowInspector.tsx`
- Modify: `src/components/admin/WorkflowWorkbench.test.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Inspector emits typed node config patches and never accepts API keys, endpoint URLs or arbitrary headers.
- It exposes labels `系统提示`, `Prompt 模板`, `输出格式`, `输出变量`, `温度`, `超时`, `最大重试` only for configured AI nodes.

- [ ] **Step 1: Extend source contracts before implementation**

Assert the inspector source contains all AI configuration labels, numeric bounds, `deepseek`, and no `apiKey` input. Assert the workbench still keeps `workflow_canvas` and `workflow_runs` saves separate.

- [ ] **Step 2: Run the source test and verify it fails**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts`

Expected: FAIL because the AI configuration controls do not exist.

- [ ] **Step 3: Implement controlled AI fields**

Render textarea fields for system/prompt templates, selects for text/JSON, text input for output variable, and number inputs for temperature/timeout/retries. Clamp values before calling `updateNode`; show inline validation errors; keep the read-only behavior in preview/run modes.

- [ ] **Step 4: Add responsive styles and run focused tests**

Run: `pnpm exec vitest run src/components/admin/WorkflowWorkbench.test.ts && pnpm exec eslint src/components/admin/workflows/WorkflowInspector.tsx`

Expected: source contracts and ESLint PASS.

- [ ] **Step 5: Commit inspector configuration**

```bash
git add src/components/admin/workflows/WorkflowInspector.tsx src/components/admin/WorkflowWorkbench.test.ts src/app/globals.css
git commit -m "feat: configure workflow ai nodes"
```

### Task 7: Async player/workbench orchestration

**Files:**
- Modify: `src/components/admin/workflows/WorkflowPlayer.tsx`
- Modify: `src/components/admin/workflows/WorkflowPlayer.test.ts`
- Modify: `src/components/admin/workflows/WorkflowWorkbench.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Player displays `执行中`、`重试中`、`失败`, and emits `onRetryCurrentNode` and `onFollowErrorBranch` callbacks.
- Workbench runs an AbortController per AI request, persists every execution state transition, and ignores stale responses by `runId + nodeId + attempt`.

- [ ] **Step 1: Extend player contracts**

Assert visible controls `重试当前节点`, `走错误分支`, `执行中`, `重试中`, and that duplicate execution controls are disabled while a request is active.

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `pnpm exec vitest run src/components/admin/workflows/WorkflowPlayer.test.ts`

Expected: FAIL because the AI execution states and controls do not exist.

- [ ] **Step 3: Implement async workbench orchestration**

When the runtime reaches an AI boundary, call the typed client with the current safe context, mark the run executing, persist it, and then apply success/failure through the runtime helpers. Abort on mode change/unmount. Retry only the current AI node; do not replay completed history. Allow an explicit error-branch action only if an `error` edge exists.

- [ ] **Step 4: Implement player states and error presentation**

Keep the last safe error in an inline `role="alert"` region, show retryability and attempt count, and never show raw upstream body or stack. Use icon+text controls and retain keyboard/focus behavior.

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm exec vitest run src/components/admin/workflows/WorkflowPlayer.test.ts src/components/admin/WorkflowWorkbench.test.ts src/lib/workflows`

Expected: all Workflow tests PASS.

```bash
git add src/components/admin/workflows/WorkflowPlayer.tsx src/components/admin/workflows/WorkflowPlayer.test.ts src/components/admin/workflows/WorkflowWorkbench.tsx src/app/globals.css
git commit -m "feat: run ai nodes from workflow player"
```

### Task 8: Route, browser and verification evidence

**Files:**
- Modify: `e2e/admin-workflows.spec.ts`
- No unrelated source files.

- [ ] **Step 1: Add the authenticated workflow acceptance flow**

Create an E2E scenario that adds human input → configured AI → human confirmation, starts the run, verifies `执行中`, waits for a mocked or configured safe response, verifies the output variable and confirmation pause, then refreshes and resumes from `workflow_runs`. Add a no-key scenario that verifies a visible safe error rather than mock success.

- [ ] **Step 2: Run the Workflow verification set**

Run:

```bash
pnpm exec vitest run src/lib/workflows src/app/api/admin/workflows/execute/route.test.ts src/components/admin/WorkflowPlayer.test.ts src/components/admin/WorkflowWorkbench.test.ts src/components/admin/AdminShell.test.ts
pnpm exec eslint src/lib/workflows src/app/api/admin/workflows/execute/route.ts src/components/admin/workflows/WorkflowPlayer.tsx src/components/admin/workflows/WorkflowInspector.tsx src/components/admin/workflows/WorkflowWorkbench.tsx
pnpm typecheck
git diff --check
```

Expected: targeted tests and ESLint pass; typecheck results must distinguish new errors from existing repository baseline errors.

- [ ] **Step 3: Run browser and build checks**

Run `pnpm exec playwright test e2e/admin-workflows.spec.ts` and `pnpm build`. If browser bootstrap, authentication, provider key, or the existing `.next` development lock blocks execution, record the exact blocker and do not claim real AI/browser/build success.

- [ ] **Step 4: Inspect final scope and commit E2E evidence**

Run `git status --short` and confirm only Workflow/AI execution files changed in this phase. Commit the E2E changes:

```bash
git add e2e/admin-workflows.spec.ts
git commit -m "test: cover workflow ai execution"
```

- [ ] **Step 5: Produce the handoff report**

Report pure-function, Route Handler, component, typecheck, build, browser, and real DeepSeek evidence separately. State whether `DEEPSEEK_API_KEY` was available and never call a no-key fallback a successful AI run.

