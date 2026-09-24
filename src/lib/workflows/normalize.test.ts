import { describe, expect, it } from 'vitest'
import type { WorkflowDocument } from './types'
import { normalizeWorkflowCanvas } from './normalize'

const fixtureWorkflow: WorkflowDocument = {
  version: 1,
  id: 'flow-1',
  name: 'Fixture',
  description: '',
  inputs: [],
  variables: [],
  nodes: [{
    id: 'n1', kind: 'thinking', subtype: 'question', position: { x: 0, y: 0 },
    title: 'Question', description: '', color: 'green', config: {},
    inputs: [], outputs: [{ id: 'out', name: '下一步', dataType: 'text' }],
    execution: { mode: 'manual' },
  }],
  edges: [],
  settings: { entryNodeId: 'n1', errorPolicy: 'stop' },
  viewport: { x: 0, y: 0, zoom: 1 },
  updatedAt: '2026-09-24T00:00:00.000Z',
}

describe('workflow metadata normalization', () => {
  it('returns an empty editable workflow for malformed metadata', () => {
    const result = normalizeWorkflowCanvas({ workflows: [{ id: 1, nodes: 'bad' }] })
    expect(result.version).toBe(1)
    expect(result.workflows).toHaveLength(1)
    expect(result.workflows[0].nodes).toEqual([])
  })

  it('removes edges that reference missing nodes or ports', () => {
    const result = normalizeWorkflowCanvas({
      version: 1,
      activeWorkflowId: 'flow-1',
      workflows: [{ ...fixtureWorkflow, edges: [{ id: 'e', source: { nodeId: 'missing', portId: 'out' }, target: { nodeId: 'n1', portId: 'in' } }] }],
    })
    expect(result.workflows[0].edges).toEqual([])
  })

  it('clamps an invalid viewport zoom and keeps the active workflow valid', () => {
    const result = normalizeWorkflowCanvas({
      version: 1,
      activeWorkflowId: 'missing',
      workflows: [{ ...fixtureWorkflow, viewport: { x: 20, y: -10, zoom: 99 } }],
    })
    expect(result.workflows[0].viewport).toEqual({ x: 20, y: -10, zoom: 2 })
    expect(result.activeWorkflowId).toBe('flow-1')
  })
})
