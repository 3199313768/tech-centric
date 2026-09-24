import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createWorkflow, getRunBlockReason, updateNode } from './graph'

const first = addNode(createWorkflow('Fixture'), { kind: 'thinking', subtype: 'question', title: 'Question', position: { x: 0, y: 0 } })
const fixtureWorkflow = updateNode(first, first.nodes[0].id, { execution: { mode: 'disabled' } })

describe('workflow graph mutations', () => {
  it('creates an edge only when source and target ports exist', () => {
    const withTarget = addNode(fixtureWorkflow, { kind: 'thinking', subtype: 'analysis', title: 'Analysis', position: { x: 160, y: 0 } })
    const targetId = withTarget.nodes[1].id
    const next = addEdge(withTarget, { nodeId: withTarget.nodes[0].id, portId: 'out' }, { nodeId: targetId, portId: 'in' })
    expect(next.edges).toHaveLength(1)
    expect(addEdge(next, { nodeId: 'missing', portId: 'out' }, { nodeId: targetId, portId: 'in' })).toEqual(next)
  })

  it('blocks run mode when a node is not configured', () => {
    expect(getRunBlockReason(fixtureWorkflow)).toContain('尚未配置')
  })

  it('does not mutate the original workflow when moving or updating nodes', () => {
    const moved = addNode(createWorkflow('Fixture'), { kind: 'thinking', subtype: 'question', position: { x: 0, y: 0 } })
    const next = updateNode(moved, moved.nodes[0].id, { title: '更新后的节点' })
    expect(next).not.toBe(moved)
    expect(moved.nodes[0].title).toBe('新节点')
    expect(next.nodes[0].title).toBe('更新后的节点')
  })
})
