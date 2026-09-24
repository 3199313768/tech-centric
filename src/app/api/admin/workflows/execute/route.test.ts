import { NextResponse } from 'next/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { addNode, updateNode } from '@/lib/workflows/graph'
import { createEmptyWorkflow } from '@/lib/workflows/normalize'
import { requireApiSuperAdmin } from '@/lib/auth/apiRequireUser'
import { executeWorkflowAi } from '@/lib/workflows/server/aiExecutor'
import { POST } from './route'

vi.mock('@/lib/auth/apiRequireUser', () => ({ requireApiSuperAdmin: vi.fn() }))
vi.mock('@/lib/workflows/server/aiExecutor', () => ({ executeWorkflowAi: vi.fn() }))

const workflow = (() => {
  const created = addNode(createEmptyWorkflow('AI 流程'), { kind: 'ai', subtype: 'analysis', title: 'AI 分析', position: { x: 0, y: 0 } })
  return updateNode(created, created.nodes[0].id, {
    execution: { mode: 'configured', provider: 'ai' },
    config: {
      ai: {
        provider: 'deepseek',
        systemPrompt: '',
        promptTemplate: 'Summarize {{inputs.topic}}',
        temperature: 0.2,
        responseFormat: 'text',
        outputVariable: 'summary',
        maxRetries: 2,
        timeoutMs: 30_000,
      },
    },
  })
})()

const user = { id: 'user-1', user_metadata: { workflow_canvas: { version: 1, activeWorkflowId: workflow.id, workflows: [workflow] } } } as never

function request(body: unknown): Request {
  return new Request('http://localhost/api/admin/workflows/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireApiSuperAdmin).mockResolvedValue({ user, response: null })
  vi.mocked(executeWorkflowAi).mockResolvedValue({ ok: true, output: 'done', usage: { inputChars: 10, outputChars: 4 }, retryable: false })
})

describe('workflow ai execute route', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireApiSuperAdmin).mockResolvedValue({ user: null, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) })
    const response = await POST(request({}))
    expect(response.status).toBe(401)
    expect(executeWorkflowAi).not.toHaveBeenCalled()
  })

  it('rejects malformed or tampered execution requests', async () => {
    const malformed = await POST(request({ workflowId: workflow.id }))
    expect(malformed.status).toBe(400)
    const tampered = await POST(request({ workflowId: workflow.id, runId: 'run-1', nodeId: workflow.nodes[0].id, inputs: { topic: '发布' }, variables: {}, attempt: 1, apiKey: 'secret', endpoint: 'https://evil.test' }))
    expect(tampered.status).toBe(200)
    expect(executeWorkflowAi).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(await tampered.json())).not.toContain('secret')
  })

  it('returns safe mapped output for a configured AI node', async () => {
    const response = await POST(request({ workflowId: workflow.id, runId: 'run-1', nodeId: workflow.nodes[0].id, inputs: { topic: '发布' }, variables: {}, attempt: 1 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, variables: { summary: 'done' } })
  })
})
