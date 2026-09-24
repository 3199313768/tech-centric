import { describe, expect, it, vi } from 'vitest'
import type { WorkflowRunMetadata } from './types'
import { createWorkflowRunSaveCoordinator } from './runPersistence'

const firstMetadata: WorkflowRunMetadata = { version: 1, activeRunId: 'run-a', runs: [] }
const secondMetadata: WorkflowRunMetadata = { version: 1, activeRunId: 'run-b', runs: [] }

describe('workflow run save coordinator', () => {
  it('does not let an older write clear the pending newer snapshot', async () => {
    const resolvers: Array<(value: { error: Error | null }) => void> = []
    const save = vi.fn(() => new Promise<{ error: Error | null }>((resolve) => resolvers.push(resolve)))
    const coordinator = createWorkflowRunSaveCoordinator(save, 0)
    coordinator.schedule(firstMetadata)
    const firstFlush = coordinator.flush()
    await Promise.resolve()
    coordinator.schedule(secondMetadata)
    const secondFlush = coordinator.flush()
    await Promise.resolve()
    resolvers[0]({ error: null })
    expect(coordinator.getState().pending).toBe(true)
    resolvers[1]({ error: null })
    await Promise.all([firstFlush, secondFlush])
    expect(coordinator.getState()).toEqual({ pending: false, error: null })
  })

  it('keeps the latest error available for retry', async () => {
    const resolvers: Array<(value: { error: Error | null }) => void> = []
    const coordinator = createWorkflowRunSaveCoordinator(() => new Promise<{ error: Error | null }>((resolve) => resolvers.push(resolve)), 0)
    coordinator.schedule(firstMetadata)
    const firstFlush = coordinator.flush()
    await Promise.resolve()
    resolvers[0]({ error: new Error('network') })
    await firstFlush
    expect(coordinator.getState().error?.message).toBe('network')
    coordinator.retry()
    resolvers[1]({ error: null })
    await Promise.resolve()
    expect(coordinator.getState()).toEqual({ pending: false, error: null })
  })
})
