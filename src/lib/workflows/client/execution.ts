import type { WorkflowDocument, WorkflowJsonValue, WorkflowNode, WorkflowRun, WorkflowValueMap } from '../types'

export type WorkflowNodeExecutionInput = {
  workflow: WorkflowDocument
  run: WorkflowRun
  node: WorkflowNode
  attempt: number
  signal?: AbortSignal
}

export type WorkflowNodeExecutionResult =
  | { ok: true; output: WorkflowJsonValue; variables: WorkflowValueMap; usage?: { inputChars: number; outputChars: number } }
  | { ok: false; error: string; retryable: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown, depth = 0): value is WorkflowJsonValue {
  if (depth > 4) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 32 && value.every((item) => isJsonValue(item, depth + 1))
  return isRecord(value) && Object.keys(value).length <= 64 && Object.values(value).every((item) => isJsonValue(item, depth + 1))
}

function isValueMap(value: unknown): value is WorkflowValueMap {
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item))
}

function safeError(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error.length <= 300) return payload.error
  return fallback
}

export async function executeWorkflowNode(input: WorkflowNodeExecutionInput, signal?: AbortSignal): Promise<WorkflowNodeExecutionResult> {
  try {
    const response = await fetch('/api/admin/workflows/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal ?? input.signal,
      body: JSON.stringify({
        workflowId: input.workflow.id,
        runId: input.run.id,
        nodeId: input.node.id,
        inputs: input.run.inputs,
        variables: input.run.variables,
        attempt: input.attempt,
      }),
    })
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return { ok: false, error: 'AI 执行返回格式无效。', retryable: response.status >= 500 }
    }
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      return { ok: false, error: safeError(payload, response.status >= 500 ? 'AI 服务暂时不可用，可重试。' : 'AI 执行失败。'), retryable: isRecord(payload) && payload.retryable === true }
    }
    if (!isJsonValue(payload.output) || !isValueMap(payload.variables)) return { ok: false, error: 'AI 执行结果不符合安全结构。', retryable: false }
    const usage = isRecord(payload.usage) && typeof payload.usage.inputChars === 'number' && typeof payload.usage.outputChars === 'number'
      ? { inputChars: payload.usage.inputChars, outputChars: payload.usage.outputChars }
      : undefined
    return { ok: true, output: payload.output, variables: payload.variables, ...(usage ? { usage } : {}) }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { ok: false, error: 'AI 执行已取消。', retryable: false }
    return { ok: false, error: '无法连接 AI 执行服务，可重试。', retryable: true }
  }
}
