import type { WorkflowRunMetadata } from './types'

export interface WorkflowRunSaveState {
  pending: boolean
  error: Error | null
}

export interface WorkflowRunSaveCoordinator {
  schedule: (metadata: WorkflowRunMetadata) => void
  retry: () => void
  flush: () => Promise<void>
  dispose: () => void
  getState: () => WorkflowRunSaveState
}

export function createWorkflowRunSaveCoordinator(
  save: (metadata: WorkflowRunMetadata) => Promise<{ error: Error | null }>,
  delayMs = 450,
  onStateChange?: (state: WorkflowRunSaveState) => void,
): WorkflowRunSaveCoordinator {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestMetadata: WorkflowRunMetadata | null = null
  let requestSequence = 0
  let disposed = false
  let state: WorkflowRunSaveState = { pending: false, error: null }

  const setState = (next: WorkflowRunSaveState) => {
    state = next
    onStateChange?.(next)
  }

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const send = async (metadata: WorkflowRunMetadata, sequence: number) => {
    const result = await save(metadata)
    if (disposed || sequence !== requestSequence) return
    setState({ pending: false, error: result.error })
  }

  const flush = async () => {
    clearTimer()
    if (!latestMetadata || disposed) return
    const sequence = requestSequence
    await send(latestMetadata, sequence)
  }

  return {
    schedule(metadata) {
      latestMetadata = metadata
      requestSequence += 1
      setState({ pending: true, error: null })
      clearTimer()
      timer = setTimeout(() => { timer = null; void send(metadata, requestSequence) }, delayMs)
    },
    retry() {
      if (!latestMetadata || disposed) return
      requestSequence += 1
      setState({ pending: true, error: null })
      void send(latestMetadata, requestSequence)
    },
    flush,
    dispose() {
      disposed = true
      clearTimer()
    },
    getState() {
      return state
    },
  }
}
