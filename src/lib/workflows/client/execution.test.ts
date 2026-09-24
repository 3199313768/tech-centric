import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeWorkflowNode } from './execution'
import type { WorkflowDocument, WorkflowNode, WorkflowRun } from '../types'

const node: WorkflowNode = {
  id: 'node-ai', kind: 'ai', subtype: 'analysis', position: { x: 0, y: 0 }, title: '分析', description: '', color: 'green', config: {}, inputs: [], outputs: [], execution: { mode: 'configured', provider: 'ai' },
}
const workflow = { id: 'flow-1' } as WorkflowDocument
const run = { id: 'run-1', inputs: { topic: '发布' }, variables: {} } as unknown as WorkflowRun

beforeEach(() => vi.restoreAllMocks())

describe('executeWorkflowNode', () => {
  it('sends only server-owned execution identifiers and returns validated output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, output: 'done', variables: { summary: 'done' } }), { status: 200 }))
    const result = await executeWorkflowNode({ workflow, run, node, attempt: 1 })
    expect(result).toMatchObject({ ok: true, variables: { summary: 'done' } })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ workflowId: 'flow-1', runId: 'run-1', nodeId: 'node-ai', inputs: { topic: '发布' }, variables: {}, attempt: 1 })
  })

  it('keeps server error messages bounded and retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'AI 服务暂时不可用，可重试。', retryable: true }), { status: 502 }))
    await expect(executeWorkflowNode({ workflow, run, node, attempt: 1 })).resolves.toEqual({ ok: false, error: 'AI 服务暂时不可用，可重试。', retryable: true })
  })
})
