import { NextResponse } from 'next/server'
import { requireApiSuperAdmin } from '@/lib/auth/apiRequireUser'
import { mapAiOutput } from '@/lib/workflows/aiResult'
import { normalizeWorkflowAiConfig, normalizeWorkflowCanvas } from '@/lib/workflows/normalize'
import { renderWorkflowTemplate } from '@/lib/workflows/templates'
import type { WorkflowJsonValue, WorkflowValueMap } from '@/lib/workflows/types'
import { executeWorkflowAi } from '@/lib/workflows/server/aiExecutor'

const MAX_BODY_BYTES = 64 * 1024
const MAX_CONTEXT_BYTES = 32 * 1024

type ExecuteRequest = {
  workflowId: string
  runId: string
  nodeId: string
  inputs: WorkflowValueMap
  variables: WorkflowValueMap
  attempt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown, depth = 0): value is WorkflowJsonValue {
  if (depth > 4) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 32 && value.every((item) => isJsonValue(item, depth + 1))
  return isRecord(value) && Object.keys(value).length <= 64 && Object.entries(value).every(([key, item]) => /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(key) && isJsonValue(item, depth + 1))
}

function isValueMap(value: unknown): value is WorkflowValueMap {
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item))
}

function parseRequestBody(value: unknown): ExecuteRequest | null {
  if (!isRecord(value)) return null
  const workflowId = typeof value.workflowId === 'string' ? value.workflowId.trim() : ''
  const runId = typeof value.runId === 'string' ? value.runId.trim() : ''
  const nodeId = typeof value.nodeId === 'string' ? value.nodeId.trim() : ''
  const attempt = value.attempt
  if (!workflowId || !runId || !nodeId || typeof attempt !== 'number' || !Number.isInteger(attempt) || attempt < 1 || attempt > 3) return null
  if (!isValueMap(value.inputs) || !isValueMap(value.variables)) return null
  return { workflowId, runId, nodeId, inputs: value.inputs, variables: value.variables, attempt }
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function errorResponse(error: string, status: number, retryable = false) {
  return NextResponse.json({ ok: false, error, retryable }, { status })
}

export async function POST(request: Request) {
  const auth = await requireApiSuperAdmin()
  if (auth.response) return auth.response

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) return errorResponse('请求内容过大。', 413)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('请求格式无效。', 400)
  }
  if (jsonSize(body) > MAX_BODY_BYTES) return errorResponse('请求内容过大。', 413)
  const input = parseRequestBody(body)
  if (!input || jsonSize({ inputs: input?.inputs, variables: input?.variables }) > MAX_CONTEXT_BYTES) {
    return errorResponse('执行请求参数无效。', 400)
  }

  const metadata = auth.user.user_metadata?.workflow_canvas
  const canvas = normalizeWorkflowCanvas(metadata)
  const workflow = canvas.workflows.find((item) => item.id === input.workflowId)
  if (!workflow) return errorResponse('流程不存在。', 404)
  const node = workflow.nodes.find((item) => item.id === input.nodeId)
  if (!node) return errorResponse('节点不存在。', 404)
  if (node.kind !== 'ai' || node.execution.mode !== 'configured' || node.execution.provider !== 'ai') {
    return errorResponse('节点尚未配置为可执行的 AI 节点。', 422)
  }
  const config = normalizeWorkflowAiConfig(node.config.ai)
  if (!config) return errorResponse('AI 节点配置无效。', 422)

  const context = { inputs: input.inputs, variables: input.variables, nodes: {} }
  const systemPrompt = renderWorkflowTemplate(config.systemPrompt, context)
  const prompt = renderWorkflowTemplate(config.promptTemplate, context)
  if (!systemPrompt.ok) return errorResponse(systemPrompt.error, 422)
  if (!prompt.ok) return errorResponse(prompt.error, 422)

  const result = await executeWorkflowAi({ config, systemPrompt: systemPrompt.text, prompt: prompt.text, attempt: input.attempt })
  if (!result.ok) return errorResponse(result.error, result.retryable ? 502 : 422, result.retryable)

  return NextResponse.json({
    ok: true,
    runId: input.runId,
    nodeId: input.nodeId,
    output: result.output,
    variables: mapAiOutput(result.output, config.outputVariable),
    usage: result.usage,
    retryable: false,
  })
}
