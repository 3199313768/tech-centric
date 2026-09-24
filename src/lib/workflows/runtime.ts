import type {
  WorkflowDocument,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRun,
  WorkflowValue,
  WorkflowValueMap,
  WorkflowWaitingState,
} from './types'

const DEFAULT_MAX_STEPS = 100

export type WorkflowAsyncExecutionInput = {
  workflow: WorkflowDocument
  run: WorkflowRun
  node: WorkflowNode
  attempt: number
  signal?: AbortSignal
}

export type WorkflowAsyncExecutionResult =
  | { ok: true; output: WorkflowValue; variables: WorkflowValueMap }
  | { ok: false; error: string; retryable: boolean }

export type WorkflowAsyncExecutor = (input: WorkflowAsyncExecutionInput) => Promise<WorkflowAsyncExecutionResult>

export type WorkflowAsyncStatus = 'executing' | 'retrying'

function now(): string {
  return new Date().toISOString()
}

function createRunId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `run-${uuid}` : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function withTimestamp(run: WorkflowRun, patch: Partial<WorkflowRun>): WorkflowRun {
  return { ...run, ...patch, updatedAt: now() }
}

function failRun(run: WorkflowRun, error: string): WorkflowRun {
  return withTimestamp(run, { status: 'failed', waiting: null, nextPortId: null, error })
}

function getNode(workflow: WorkflowDocument, nodeId: string | null): WorkflowNode | null {
  return nodeId ? workflow.nodes.find((node) => node.id === nodeId) ?? null : null
}

function getOutgoingEdge(workflow: WorkflowDocument, nodeId: string, portId: string): WorkflowEdge | null {
  return workflow.edges.find((edge) => edge.source.nodeId === nodeId && edge.source.portId === portId) ?? null
}

function parseSelectOptions(node: WorkflowNode): Array<{ value: string; label: string }> {
  if (typeof node.config.options !== 'string') return []
  return node.config.options.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).map((item) => ({ value: item, label: item }))
}

function getWaitingState(node: WorkflowNode): WorkflowWaitingState | null {
  if (node.kind === 'control' && node.subtype === 'decision') {
    return { nodeId: node.id, kind: 'select', prompt: node.description || '请选择下一条分支。', options: [{ value: 'yes', label: '是' }, { value: 'no', label: '否' }] }
  }
  if (node.kind !== 'human') return null
  if (node.subtype === 'input') return { nodeId: node.id, kind: 'input', prompt: node.description || '请输入内容。' }
  if (node.subtype === 'approval' || node.subtype === 'confirm') return { nodeId: node.id, kind: 'confirm', prompt: node.description || '请确认是否继续。' }
  if (node.subtype === 'select') {
    const options = parseSelectOptions(node)
    return { nodeId: node.id, kind: 'select', prompt: node.description || '请选择一个选项。', ...(options.length > 0 ? { options } : {}) }
  }
  return null
}

function isExternalNode(node: WorkflowNode): boolean {
  return node.kind === 'ai' || node.kind === 'system' || node.execution.mode === 'disabled' || (node.execution.mode === 'configured' && Boolean(node.execution.provider))
}

function isConfiguredAiNode(node: WorkflowNode): boolean {
  return node.kind === 'ai' && node.execution.mode === 'configured' && node.execution.provider === 'ai'
}

function getMaxRetries(node: WorkflowNode): number {
  const value = node.config.ai
  if (typeof value !== 'object' || value === null || Array.isArray(value) || typeof value.maxRetries !== 'number' || !Number.isFinite(value.maxRetries)) return 0
  return Math.min(2, Math.max(0, Math.floor(value.maxRetries)))
}

function appendHistory(run: WorkflowRun, nodeId: string, output?: WorkflowValueMap): WorkflowRun {
  return {
    ...run,
    history: [...run.history, { nodeId, status: 'completed', ...(output ? { output } : {}), at: now() }],
  }
}

function routeToNext(run: WorkflowRun, workflow: WorkflowDocument, node: WorkflowNode, portId: string): WorkflowRun {
  const edge = getOutgoingEdge(workflow, node.id, portId)
  if (!edge) return withTimestamp(run, { status: 'completed', currentNodeId: node.id, nextPortId: null, waiting: null, error: null })
  return withTimestamp(run, { status: 'running', currentNodeId: edge.target.nodeId, nextPortId: null, waiting: null, error: null })
}

export function retryWorkflowNode(run: WorkflowRun): WorkflowRun {
  if (run.status !== 'failed' || !run.currentNodeId) return run
  return withTimestamp(run, { status: 'running', waiting: null, nextPortId: null, error: null })
}

export function followWorkflowError(run: WorkflowRun, workflow: WorkflowDocument): WorkflowRun {
  if (run.status !== 'failed' || !run.currentNodeId) return run
  const edge = getOutgoingEdge(workflow, run.currentNodeId, 'error')
  if (!edge) return run
  return withTimestamp(run, { status: 'running', currentNodeId: edge.target.nodeId, nextPortId: null, waiting: null, error: null })
}

export function startWorkflow(workflow: WorkflowDocument, inputs: WorkflowValueMap): WorkflowRun {
  const timestamp = now()
  const entryNodeId = workflow.settings.entryNodeId
  const entry = getNode(workflow, entryNodeId)
  const run: WorkflowRun = {
    version: 1,
    id: createRunId(),
    workflowId: workflow.id,
    status: entry ? 'running' : 'failed',
    currentNodeId: entry?.id ?? null,
    nextPortId: null,
    inputs: { ...inputs },
    variables: {},
    waiting: null,
    history: [],
    error: entry ? null : '流程没有有效的入口节点。',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return run
}

export function advanceWorkflow(run: WorkflowRun, workflow: WorkflowDocument, maxSteps = DEFAULT_MAX_STEPS): WorkflowRun {
  if (run.status !== 'running') return run
  let next = run
  const limit = Math.max(1, Math.floor(maxSteps))
  for (let step = 0; step < limit; step += 1) {
    const node = getNode(workflow, next.currentNodeId)
    if (!node) return failRun(next, '当前运行节点不存在，流程无法继续。')
    if (next.nextPortId) {
      const routed = routeToNext(next, workflow, node, next.nextPortId)
      if (routed.status === 'completed') return routed
      next = routed
      continue
    }
    if (isExternalNode(node)) return failRun(next, `节点「${node.title}」需要第三阶段的外部执行能力。`)
    const waiting = getWaitingState(node)
    if (waiting) return withTimestamp(next, { status: 'waiting', waiting, error: null })
    next = appendHistory(next, node.id)
    const routed = routeToNext(next, workflow, node, 'out')
    if (routed.status === 'completed') return routed
    next = routed
  }
  return failRun(next, `流程超过 ${limit} 步数上限，可能存在未收敛的循环。`)
}

export async function advanceWorkflowAsync(
  run: WorkflowRun,
  workflow: WorkflowDocument,
  execute: WorkflowAsyncExecutor,
  options: { maxSteps?: number; onStatus?: (status: WorkflowAsyncStatus, node: WorkflowNode, attempt: number) => void; signal?: AbortSignal } = {},
): Promise<WorkflowRun> {
  if (run.status !== 'running') return run
  let next = run
  const limit = Math.max(1, Math.floor(options.maxSteps ?? DEFAULT_MAX_STEPS))
  for (let step = 0; step < limit; step += 1) {
    const node = getNode(workflow, next.currentNodeId)
    if (!node) return failRun(next, '当前运行节点不存在，流程无法继续。')
    if (next.nextPortId) {
      const routed = routeToNext(next, workflow, node, next.nextPortId)
      if (routed.status === 'completed') return routed
      next = routed
      continue
    }
    if (isConfiguredAiNode(node)) {
      const maxAttempts = getMaxRetries(node) + 1
      let result: WorkflowAsyncExecutionResult | null = null
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        options.onStatus?.(attempt === 1 ? 'executing' : 'retrying', node, attempt)
        result = await execute({ workflow, run: next, node, attempt, signal: options.signal })
        if (result.ok || !result.retryable || attempt === maxAttempts) break
      }
      if (!result || !result.ok) return failRun(next, result?.error ?? 'AI 执行失败。')
      next = appendHistory(next, node.id, result.variables)
      next = withTimestamp(next, { variables: { ...next.variables, ...result.variables } })
      const routed = routeToNext(next, workflow, node, 'out')
      if (routed.status === 'completed') return routed
      next = routed
      continue
    }
    if (isExternalNode(node)) return failRun(next, `节点「${node.title}」需要外部执行能力。`)
    const waiting = getWaitingState(node)
    if (waiting) return withTimestamp(next, { status: 'waiting', waiting, error: null })
    next = appendHistory(next, node.id)
    const routed = routeToNext(next, workflow, node, 'out')
    if (routed.status === 'completed') return routed
    next = routed
  }
  return failRun(next, `流程超过 ${limit} 步数上限，可能存在未收敛的循环。`)
}

export function resolveWaiting(run: WorkflowRun, response: WorkflowValue): WorkflowRun {
  if (run.status !== 'waiting' || !run.waiting || !run.currentNodeId) return run
  const waiting = run.waiting
  if (waiting.kind === 'input' && response === null) return failRun(run, '输入不能为空。')
  if (waiting.kind === 'confirm' && typeof response !== 'boolean') return failRun(run, '确认节点需要布尔值响应。')
  if (waiting.kind === 'select' && (typeof response !== 'string' || !response.trim())) return failRun(run, '选择节点需要有效的选项。')
  if (waiting.options && (typeof response !== 'string' || !waiting.options.some((option) => option.value === response))) return failRun(run, '所选选项已失效，请重新选择。')
  const nodeKey = waiting.nodeId
  const nextPortId = waiting.kind === 'select' && typeof response === 'string' && (response === 'yes' || response === 'no') ? response : 'out'
  return withTimestamp(appendHistory(run, waiting.nodeId, { [nodeKey]: response }), {
    status: 'running',
    waiting: null,
    nextPortId,
    variables: { ...run.variables, [nodeKey]: response },
    error: null,
  })
}

export function cancelWorkflow(run: WorkflowRun): WorkflowRun {
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') return run
  return withTimestamp(run, { status: 'cancelled', waiting: null, nextPortId: null, error: null })
}

export function getRunProgress(run: WorkflowRun, workflow: WorkflowDocument): { completed: number; total: number; currentTitle: string | null } {
  const completed = new Set(run.history.filter((item) => item.status === 'completed').map((item) => item.nodeId)).size
  return { completed, total: workflow.nodes.length, currentTitle: getNode(workflow, run.currentNodeId)?.title ?? null }
}
