import { describe, expect, it, vi } from 'vitest'
import { advanceWorkflowAsync, followWorkflowError, retryWorkflowNode, startWorkflow } from './runtime'
import type { WorkflowDocument, WorkflowNode } from './types'

function makeWorkflow(): WorkflowDocument {
  const node: WorkflowNode = { id: 'ai', kind: 'ai', subtype: 'analysis', position: { x: 0, y: 0 }, title: 'AI', description: '', color: 'green', config: { ai: { maxRetries: 1 } }, inputs: [], outputs: [{ id: 'out', name: '下一步', dataType: 'json' }], execution: { mode: 'configured', provider: 'ai' } }
  return { version: 1, id: 'flow', name: '流程', description: '', inputs: [], variables: [], nodes: [node], edges: [], settings: { entryNodeId: 'ai', errorPolicy: 'stop' }, viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: '2026-09-24T00:00:00.000Z' }
}

describe('advanceWorkflowAsync', () => {
  it('retries retryable AI failures and stores mapped variables', async () => {
    const execute = vi.fn().mockResolvedValueOnce({ ok: false, error: 'temporary', retryable: true }).mockResolvedValueOnce({ ok: true, output: 'done', variables: { summary: 'done' } })
    const statuses: string[] = []
    const result = await advanceWorkflowAsync(startWorkflow(makeWorkflow(), {}), makeWorkflow(), execute, { onStatus: (status) => statuses.push(status) })
    expect(result.status).toBe('completed')
    expect(result.variables).toEqual({ summary: 'done' })
    expect(execute).toHaveBeenCalledTimes(2)
    expect(statuses).toEqual(['executing', 'retrying'])
  })

  it('resets a failed AI node without replaying history and follows an explicit error edge', () => {
    const workflow = makeWorkflow()
    const failed = { ...startWorkflow(workflow, {}), status: 'failed' as const, error: 'temporary' }
    expect(retryWorkflowNode(failed)).toMatchObject({ status: 'running', currentNodeId: 'ai', error: null })
    const target = { ...workflow, nodes: [...workflow.nodes, { ...workflow.nodes[0], id: 'fallback', kind: 'thinking' as const, execution: { mode: 'manual' as const } }], edges: [{ id: 'error', source: { nodeId: 'ai', portId: 'error' }, target: { nodeId: 'fallback', portId: 'out' } }] }
    expect(followWorkflowError(failed, target)).toMatchObject({ status: 'running', currentNodeId: 'fallback', error: null })
  })
})
