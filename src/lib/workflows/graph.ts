import { createEmptyWorkflow } from './normalize'
import type {
  WorkflowDocument,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowPort,
  WorkflowPortRef,
} from './types'

export interface AddNodeInput {
  kind: WorkflowNodeKind
  subtype: string
  title?: string
  position: { x: number; y: number }
}

export type WorkflowNodePatch = Partial<Pick<WorkflowNode, 'title' | 'description' | 'color' | 'config' | 'execution'>>

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createPorts(kind: WorkflowNodeKind, subtype: string): { inputs: WorkflowPort[]; outputs: WorkflowPort[] } {
  const inputs = kind === 'control' && subtype === 'start' ? [] : [{ id: 'in', name: '输入', dataType: 'json' as const }]
  if (kind === 'control' && subtype === 'decision') {
    return {
      inputs,
      outputs: [
        { id: 'yes', name: '是', dataType: 'boolean' },
        { id: 'no', name: '否', dataType: 'boolean' },
      ],
    }
  }
  if (kind === 'ai') return { inputs, outputs: [{ id: 'out', name: '成功', dataType: 'json' }, { id: 'error', name: '错误', dataType: 'json' }] }
  return { inputs, outputs: [{ id: 'out', name: '下一步', dataType: 'json' }] }
}

export function createWorkflow(name = '未命名流程'): WorkflowDocument {
  return createEmptyWorkflow(name)
}

export function addNode(workflow: WorkflowDocument, input: AddNodeInput): WorkflowDocument {
  const ports = createPorts(input.kind, input.subtype)
  const node: WorkflowNode = {
    id: createId('node'),
    kind: input.kind,
    subtype: input.subtype,
    position: { ...input.position },
    title: input.title?.trim() || '新节点',
    description: '',
    color: 'green',
    config: {},
    inputs: ports.inputs,
    outputs: ports.outputs,
    execution: { mode: 'manual' },
  }
  return {
    ...workflow,
    nodes: [...workflow.nodes, node],
    settings: { ...workflow.settings, entryNodeId: workflow.settings.entryNodeId ?? node.id },
    updatedAt: new Date().toISOString(),
  }
}

export function moveNodes(workflow: WorkflowDocument, nodeIds: string[], delta: { x: number; y: number }): WorkflowDocument {
  const selected = new Set(nodeIds)
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => selected.has(node.id)
      ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y } }
      : node),
    updatedAt: new Date().toISOString(),
  }
}

export function updateNode(workflow: WorkflowDocument, nodeId: string, patch: WorkflowNodePatch): WorkflowDocument {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => node.id === nodeId
      ? {
          ...node,
          ...patch,
          ...(patch.config ? { config: { ...node.config, ...patch.config } } : {}),
          ...(patch.execution ? { execution: { ...node.execution, ...patch.execution } } : {}),
        }
      : node),
    updatedAt: new Date().toISOString(),
  }
}

export function removeNodes(workflow: WorkflowDocument, nodeIds: string[]): WorkflowDocument {
  const removed = new Set(nodeIds)
  return {
    ...workflow,
    nodes: workflow.nodes.filter((node) => !removed.has(node.id)),
    edges: workflow.edges.filter((edge) => !removed.has(edge.source.nodeId) && !removed.has(edge.target.nodeId)),
    settings: {
      ...workflow.settings,
      entryNodeId: workflow.settings.entryNodeId && !removed.has(workflow.settings.entryNodeId) ? workflow.settings.entryNodeId : null,
    },
    updatedAt: new Date().toISOString(),
  }
}

function hasPort(workflow: WorkflowDocument, reference: WorkflowPortRef): boolean {
  const node = workflow.nodes.find((item) => item.id === reference.nodeId)
  return Boolean(node && [...node.inputs, ...node.outputs].some((port) => port.id === reference.portId))
}

export function addEdge(workflow: WorkflowDocument, source: WorkflowPortRef, target: WorkflowPortRef, condition?: WorkflowEdge['condition']): WorkflowDocument {
  if (source.nodeId === target.nodeId || !hasPort(workflow, source) || !hasPort(workflow, target)) return workflow
  if (workflow.edges.some((edge) => edge.source.nodeId === source.nodeId && edge.source.portId === source.portId && edge.target.nodeId === target.nodeId && edge.target.portId === target.portId)) return workflow
  const edge: WorkflowEdge = { id: createId('edge'), source: { ...source }, target: { ...target }, ...(condition ? { condition: { ...condition } } : {}) }
  return { ...workflow, edges: [...workflow.edges, edge], updatedAt: new Date().toISOString() }
}

export function removeEdge(workflow: WorkflowDocument, edgeId: string): WorkflowDocument {
  return { ...workflow, edges: workflow.edges.filter((edge) => edge.id !== edgeId), updatedAt: new Date().toISOString() }
}

export function duplicateWorkflow(workflow: WorkflowDocument): WorkflowDocument {
  const nodeIdMap = new Map(workflow.nodes.map((node) => [node.id, createId('node')]))
  const edgeIdMap = new Map(workflow.edges.map((edge) => [edge.id, createId('edge')]))
  return {
    ...workflow,
    id: createId('flow'),
    name: `${workflow.name} 副本`,
    nodes: workflow.nodes.map((node) => ({ ...node, id: nodeIdMap.get(node.id) ?? createId('node'), position: { ...node.position }, inputs: node.inputs.map((port) => ({ ...port })), outputs: node.outputs.map((port) => ({ ...port })) })),
    edges: workflow.edges.map((edge) => ({
      ...edge,
      id: edgeIdMap.get(edge.id) ?? createId('edge'),
      source: { ...edge.source, nodeId: nodeIdMap.get(edge.source.nodeId) ?? edge.source.nodeId },
      target: { ...edge.target, nodeId: nodeIdMap.get(edge.target.nodeId) ?? edge.target.nodeId },
      ...(edge.condition ? { condition: { ...edge.condition } } : {}),
    })),
    settings: { ...workflow.settings, entryNodeId: workflow.settings.entryNodeId ? nodeIdMap.get(workflow.settings.entryNodeId) ?? null : null },
    viewport: { ...workflow.viewport },
    updatedAt: new Date().toISOString(),
  }
}

export function getRunBlockReason(workflow: WorkflowDocument): string | null {
  const blocked = workflow.nodes.find((node) => node.execution.mode === 'disabled')
  return blocked ? `节点「${blocked.title}」尚未配置或已禁用，无法运行。` : null
}
