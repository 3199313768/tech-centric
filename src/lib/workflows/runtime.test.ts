import { describe, expect, it } from 'vitest'
import type { WorkflowDocument, WorkflowNode } from './types'
import { advanceWorkflow, cancelWorkflow, getRunProgress, resolveWaiting, startWorkflow } from './runtime'

function makeNode(id: string, kind: WorkflowNode['kind'], subtype: string, outputs = [{ id: 'out', name: '下一步', dataType: 'json' as const }]): WorkflowNode {
  return {
    id,
    kind,
    subtype,
    position: { x: 0, y: 0 },
    title: id,
    description: '',
    color: 'green',
    config: {},
    inputs: kind === 'control' && subtype === 'start' ? [] : [{ id: 'in', name: '输入', dataType: 'json' }],
    outputs,
    execution: { mode: 'manual' },
  }
}

function makeWorkflow(nodes: WorkflowNode[], edges: WorkflowDocument['edges']): WorkflowDocument {
  return {
    version: 1,
    id: 'flow-runtime',
    name: '运行测试',
    description: '',
    inputs: [],
    variables: [],
    nodes,
    edges,
    settings: { entryNodeId: nodes[0]?.id ?? null, errorPolicy: 'stop' },
    viewport: { x: 0, y: 0, zoom: 1 },
    updatedAt: '2026-09-24T00:00:00.000Z',
  }
}

const linearWorkflow = makeWorkflow([
  makeNode('start', 'control', 'start'),
  makeNode('input', 'human', 'input'),
  makeNode('approval', 'human', 'approval'),
  makeNode('select', 'human', 'select'),
], [
  { id: 'e1', source: { nodeId: 'start', portId: 'out' }, target: { nodeId: 'input', portId: 'in' } },
  { id: 'e2', source: { nodeId: 'input', portId: 'out' }, target: { nodeId: 'approval', portId: 'in' } },
  { id: 'e3', source: { nodeId: 'approval', portId: 'out' }, target: { nodeId: 'select', portId: 'in' } },
])

const decisionWorkflow = makeWorkflow([
  makeNode('decision', 'control', 'decision', [
    { id: 'yes', name: '是', dataType: 'boolean' },
    { id: 'no', name: '否', dataType: 'boolean' },
  ]),
  makeNode('yes-target', 'thinking', 'conclusion'),
  makeNode('no-target', 'thinking', 'conclusion'),
], [
  { id: 'yes-edge', source: { nodeId: 'decision', portId: 'yes' }, target: { nodeId: 'yes-target', portId: 'in' } },
  { id: 'no-edge', source: { nodeId: 'decision', portId: 'no' }, target: { nodeId: 'no-target', portId: 'in' } },
])

describe('workflow runtime', () => {
  it('pauses at an input node and resumes with a typed value', () => {
    const started = startWorkflow(linearWorkflow, { topic: 'release' })
    const waiting = advanceWorkflow(started, linearWorkflow)
    expect(waiting.status).toBe('waiting')
    expect(waiting.waiting?.kind).toBe('input')

    const resumed = advanceWorkflow(resolveWaiting(waiting, 'approved'), linearWorkflow)
    expect(resumed.status).toBe('waiting')
    expect(resumed.waiting?.kind).toBe('confirm')
    expect(resumed.variables).toMatchObject({ input: 'approved' })
  })

  it('uses the selected yes/no output for a decision node', () => {
    const waiting = advanceWorkflow(startWorkflow(decisionWorkflow, {}), decisionWorkflow)
    expect(waiting.waiting?.options).toEqual([{ value: 'yes', label: '是' }, { value: 'no', label: '否' }])
    const next = advanceWorkflow(resolveWaiting(waiting, 'yes'), decisionWorkflow)
    expect(next.currentNodeId).toBe('yes-target')
    expect(next.status).toBe('completed')
  })

  it('blocks external providers without making a network call', () => {
    const external = makeWorkflow([makeNode('ai', 'ai', 'analysis')], [])
    const result = advanceWorkflow(startWorkflow(external, {}), external)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('第三阶段')
  })

  it('fails a cycle after the step limit', () => {
    const cyclic = makeWorkflow([makeNode('one', 'thinking', 'analysis'), makeNode('two', 'thinking', 'analysis')], [
      { id: 'forward', source: { nodeId: 'one', portId: 'out' }, target: { nodeId: 'two', portId: 'in' } },
      { id: 'back', source: { nodeId: 'two', portId: 'out' }, target: { nodeId: 'one', portId: 'in' } },
    ])
    const result = advanceWorkflow(startWorkflow(cyclic, {}), cyclic, 3)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('步数')
  })

  it('cancels a waiting run and reports progress without division by zero', () => {
    const waiting = advanceWorkflow(startWorkflow(linearWorkflow, {}), linearWorkflow)
    const cancelled = cancelWorkflow(waiting)
    expect(cancelled.status).toBe('cancelled')
    expect(getRunProgress(cancelled, linearWorkflow)).toEqual({ completed: 1, total: 4, currentTitle: 'input' })
  })
})
