import type { WorkflowCanvasMetadata } from './types'

export interface WorkflowSaveState {
  pending: boolean
  error: Error | null
}

export interface WorkflowSaveCoordinator {
  schedule: (metadata: WorkflowCanvasMetadata) => void
  retry: () => void
  flush: () => Promise<void>
  dispose: () => void
  getState: () => WorkflowSaveState
}

export function createWorkflowSaveCoordinator(
  save: (metadata: WorkflowCanvasMetadata) => Promise<{ error: Error | null }>,
  delayMs = 450,
  onStateChange?: (state: WorkflowSaveState) => void,
): WorkflowSaveCoordinator {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestMetadata: WorkflowCanvasMetadata | null = null
  let requestSequence = 0
  let disposed = false
  let state: WorkflowSaveState = { pending: false, error: null }

  const setState = (next: WorkflowSaveState) => {
    state = next
    onStateChange?.(next)
  }

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const send = async (metadata: WorkflowCanvasMetadata, sequence: number) => {
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
