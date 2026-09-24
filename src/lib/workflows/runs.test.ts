import { describe, expect, it } from 'vitest'
import { addNode } from './graph'
import { createEmptyWorkflow } from './normalize'
import type { WorkflowRun, WorkflowRunMetadata } from './types'
import { getRecoverableRun, normalizeWorkflowRuns, saveWorkflowRuns } from './runs'

const workflow = addNode(createEmptyWorkflow('运行测试'), {
  kind: 'human',
  subtype: 'input',
  title: '输入',
  position: { x: 0, y: 0 },
})
const nodeId = workflow.nodes[0].id

const waitingRun: WorkflowRun = {
  version: 1,
  id: 'run-1',
  workflowId: workflow.id,
  status: 'waiting',
  currentNodeId: nodeId,
  nextPortId: null,
  inputs: {},
  variables: {},
  waiting: { nodeId, kind: 'input', prompt: '输入内容' },
  history: [],
  error: null,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
}

describe('workflow run metadata', () => {
  it('falls back to empty run metadata for malformed input', () => {
    const result = normalizeWorkflowRuns({ runs: 'bad' }, [workflow])
    expect(result).toEqual({ version: 1, activeRunId: null, runs: [] })
  })

  it('keeps recoverable waiting runs and drops missing-node runs', () => {
    const result = normalizeWorkflowRuns({
      version: 1,
      activeRunId: 'run-1',
      runs: [waitingRun, { ...waitingRun, id: 'run-2', currentNodeId: 'missing' }],
    }, [workflow])
    expect(result.activeRunId).toBe('run-1')
    expect(result.runs.map((run) => run.id)).toEqual(['run-1'])
    expect(getRecoverableRun(result, workflow.id)?.id).toBe('run-1')
  })

  it('retains active runs before bounded completed history', () => {
    const completedRuns: WorkflowRun[] = Array.from({ length: 4 }, (_, index) => ({
      ...waitingRun,
      id: `completed-${index}`,
      status: 'completed',
      currentNodeId: null,
      waiting: null,
      updatedAt: `2026-09-24T00:0${index}:00.000Z`,
    }))
    const metadata: WorkflowRunMetadata = { version: 1, activeRunId: null, runs: completedRuns }
    const result = saveWorkflowRuns(metadata, waitingRun, 3)
    expect(result.runs).toHaveLength(3)
    expect(result.runs[0].status).toBe('waiting')
    expect(result.activeRunId).toBe(waitingRun.id)
  })

  it('preserves bounded JSON outputs from AI nodes', () => {
    const result = normalizeWorkflowRuns({
      runs: [{ ...waitingRun, status: 'completed', currentNodeId: null, waiting: null, variables: { summary: { title: '发布', tags: ['产品'] } }, history: [{ nodeId, status: 'completed', output: { summary: { title: '发布' } }, at: waitingRun.updatedAt }] }],
    }, [workflow])
    expect(result.runs[0].variables).toEqual({ summary: { title: '发布', tags: ['产品'] } })
    expect(result.runs[0].history[0].output).toEqual({ summary: { title: '发布' } })
  })
})
