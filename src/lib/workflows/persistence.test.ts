import { describe, expect, it } from 'vitest'
import type { WorkflowCanvasMetadata } from './types'
import { createWorkflowSaveCoordinator } from './persistence'

describe('workflow save coordinator', () => {
  it('does not let an older response clear a newer dirty state', async () => {
    const metadataA: WorkflowCanvasMetadata = { version: 1, activeWorkflowId: null, workflows: [] }
    const metadataB: WorkflowCanvasMetadata = { version: 1, activeWorkflowId: 'flow-b', workflows: [] }
    const requests: Array<(result: { error: Error | null }) => void> = []
    const coordinator = createWorkflowSaveCoordinator(() => new Promise((resolve) => requests.push(resolve)), 0)

    coordinator.schedule(metadataA)
    const firstFlush = coordinator.flush()
    await Promise.resolve()
    coordinator.schedule(metadataB)
    const secondFlush = coordinator.flush()
    await Promise.resolve()
    requests[0]({ error: null })
    expect(coordinator.getState().pending).toBe(true)
    requests[1]({ error: null })
    await Promise.all([firstFlush, secondFlush])
    expect(coordinator.getState()).toEqual({ pending: false, error: null })
  })

  it('keeps the latest error available for retry', async () => {
    const metadata: WorkflowCanvasMetadata = { version: 1, activeWorkflowId: null, workflows: [] }
    const requests: Array<(result: { error: Error | null }) => void> = []
    const coordinator = createWorkflowSaveCoordinator(() => new Promise((resolve) => requests.push(resolve)), 0)
    coordinator.schedule(metadata)
    const firstFlush = coordinator.flush()
    await Promise.resolve()
    requests[0]({ error: new Error('network') })
    await firstFlush
    expect(coordinator.getState().error?.message).toBe('network')
    coordinator.retry()
    requests[1]({ error: null })
    await Promise.resolve()
    expect(coordinator.getState()).toEqual({ pending: false, error: null })
  })
})
