import type {
  WorkflowCanvasMetadata,
  WorkflowAiConfig,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeColor,
  WorkflowNodeKind,
  WorkflowPort,
  WorkflowPortDataType,
  WorkflowVariable,
  WorkflowJsonObject,
  WorkflowJsonValue,
} from './types'

const MIN_ZOOM = 0.35
const MAX_ZOOM = 2
const NODE_COLORS: WorkflowNodeColor[] = ['green', 'gold', 'rose', 'blue', 'slate']
const NODE_KINDS: WorkflowNodeKind[] = ['thinking', 'human', 'ai', 'system', 'control']
const DATA_TYPES: WorkflowPortDataType[] = ['text', 'number', 'boolean', 'json']

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : null
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeDataType(value: unknown): WorkflowPortDataType {
  return DATA_TYPES.includes(value as WorkflowPortDataType) ? value as WorkflowPortDataType : 'text'
}

function normalizePort(value: unknown, fallback: WorkflowPort): WorkflowPort {
  const record = asRecord(value)
  if (!record) return fallback
  const id = stringValue(record.id, fallback.id).trim() || fallback.id
  const name = stringValue(record.name, fallback.name).trim() || fallback.name
  const description = typeof record.description === 'string' ? record.description : fallback.description
  return {
    id,
    name,
    dataType: normalizeDataType(record.dataType),
    required: typeof record.required === 'boolean' ? record.required : fallback.required,
    ...(description ? { description } : {}),
  }
}

function defaultPorts(kind: WorkflowNodeKind, subtype: string): { inputs: WorkflowPort[]; outputs: WorkflowPort[] } {
  const inputs = kind === 'control' && subtype === 'start' ? [] : [{ id: 'in', name: '输入', dataType: 'json' as const }]
  if (kind === 'control' && subtype === 'decision') {
    return { inputs, outputs: [
      { id: 'yes', name: '是', dataType: 'boolean' },
      { id: 'no', name: '否', dataType: 'boolean' },
    ] }
  }
  return { inputs, outputs: [{ id: 'out', name: '下一步', dataType: 'json' }] }
}

function normalizeJsonValue(value: unknown, depth = 0): WorkflowJsonValue | undefined {
  if (depth > 4) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) {
    return value.slice(0, 32).map((item) => normalizeJsonValue(item, depth + 1)).filter((item): item is WorkflowJsonValue => item !== undefined)
  }
  const record = asRecord(value)
  if (!record) return undefined
  return Object.entries(record).slice(0, 64).reduce<WorkflowJsonObject>((result, [key, item]) => {
    const normalized = normalizeJsonValue(item, depth + 1)
    if (normalized !== undefined) result[key] = normalized
    return result
  }, {})
}

function normalizeConfig(value: unknown): WorkflowJsonObject {
  const record = asRecord(value)
  if (!record) return {}
  return Object.entries(record).slice(0, 64).reduce<WorkflowJsonObject>((result, [key, item]) => {
    const normalized = normalizeJsonValue(item)
    if (normalized !== undefined) result[key] = normalized
    return result
  }, {})
}

const SAFE_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function boundedText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, 8000) : fallback
}

export function normalizeWorkflowAiConfig(input: unknown): WorkflowAiConfig | null {
  const record = asRecord(input)
  if (!record || record.provider !== 'deepseek') return null
  const promptTemplate = boundedText(record.promptTemplate)
  if (!promptTemplate.trim()) return null
  const rawOutputVariable = boundedText(record.outputVariable, 'ai_output').trim()
  return {
    provider: 'deepseek',
    systemPrompt: boundedText(record.systemPrompt),
    promptTemplate,
    temperature: boundedNumber(record.temperature, 0.2, 0, 2),
    responseFormat: record.responseFormat === 'json' ? 'json' : 'text',
    outputVariable: SAFE_VARIABLE_NAME.test(rawOutputVariable) ? rawOutputVariable : 'ai_output',
    maxRetries: Math.floor(boundedNumber(record.maxRetries, 2, 0, 2)),
    timeoutMs: Math.floor(boundedNumber(record.timeoutMs, 30_000, 5_000, 60_000)),
  }
}

function normalizeNode(value: unknown, index: number): WorkflowNode | null {
  const record = asRecord(value)
  if (!record) return null
  const kind = NODE_KINDS.includes(record.kind as WorkflowNodeKind) ? record.kind as WorkflowNodeKind : 'thinking'
  const subtype = stringValue(record.subtype, 'step').trim() || 'step'
  const defaults = defaultPorts(kind, subtype)
  const nodeId = stringValue(record.id, '').trim() || createId(`node-${index}`)
  const positionRecord = asRecord(record.position)
  const executionRecord = asRecord(record.execution)
  const executionMode = executionRecord?.mode === 'configured' || executionRecord?.mode === 'disabled' ? executionRecord.mode : 'manual'
  const provider = executionRecord?.provider
  const normalizedProvider = provider === 'ai' || provider === 'http' || provider === 'database' || provider === 'file' || provider === 'webhook' ? provider : undefined
  const rawInputs = Array.isArray(record.inputs) ? record.inputs : []
  const rawOutputs = Array.isArray(record.outputs) ? record.outputs : []
  return {
    id: nodeId,
    kind,
    subtype,
    position: {
      x: numberValue(positionRecord?.x, index * 220),
      y: numberValue(positionRecord?.y, 80),
    },
    title: stringValue(record.title, '新节点').trim() || '新节点',
    description: stringValue(record.description, ''),
    color: NODE_COLORS.includes(record.color as WorkflowNodeColor) ? record.color as WorkflowNodeColor : 'green',
    config: normalizeConfig(record.config),
    inputs: defaults.inputs.map((port, portIndex) => normalizePort(rawInputs[portIndex], port)),
    outputs: defaults.outputs.map((port, portIndex) => normalizePort(rawOutputs[portIndex], port)),
    execution: {
      mode: executionMode,
      ...(normalizedProvider ? { provider: normalizedProvider } : {}),
    },
  }
}

function normalizeVariable(value: unknown, index: number): WorkflowVariable | null {
  const record = asRecord(value)
  if (!record) return null
  const name = stringValue(record.name, '').trim()
  if (!name) return null
  return {
    id: stringValue(record.id, '').trim() || createId(`variable-${index}`),
    name,
    dataType: normalizeDataType(record.dataType),
    ...(typeof record.value === 'string' ? { value: record.value } : {}),
  }
}

function normalizeEdge(value: unknown, index: number): WorkflowEdge | null {
  const record = asRecord(value)
  const source = asRecord(record?.source)
  const target = asRecord(record?.target)
  if (!source || !target) return null
  const sourceNodeId = stringValue(source.nodeId, '').trim()
  const sourcePortId = stringValue(source.portId, '').trim()
  const targetNodeId = stringValue(target.nodeId, '').trim()
  const targetPortId = stringValue(target.portId, '').trim()
  if (!sourceNodeId || !sourcePortId || !targetNodeId || !targetPortId) return null
  const condition = asRecord(record?.condition)
  const label = stringValue(condition?.label, '').trim()
  return {
    id: stringValue(record?.id, '').trim() || createId(`edge-${index}`),
    source: { nodeId: sourceNodeId, portId: sourcePortId },
    target: { nodeId: targetNodeId, portId: targetPortId },
    ...(label ? { condition: { label, ...(typeof condition?.expression === 'string' ? { expression: condition.expression } : {}) } } : {}),
  }
}

function normalizeWorkflow(value: unknown, index: number): WorkflowDocument {
  const record = asRecord(value)
  const rawNodes = Array.isArray(record?.nodes) ? record.nodes : []
  const nodes = rawNodes.map((node, nodeIndex) => normalizeNode(node, nodeIndex)).filter((node): node is WorkflowNode => node !== null)
  const nodeIds = new Set<string>()
  const uniqueNodes = nodes.filter((node) => {
    if (nodeIds.has(node.id)) return false
    nodeIds.add(node.id)
    return true
  })
  const portIds = new Map(uniqueNodes.map((node) => [node.id, new Set([...node.inputs, ...node.outputs].map((port) => port.id))]))
  const rawEdges = Array.isArray(record?.edges) ? record.edges : []
  const edges = rawEdges
    .map((edge, edgeIndex) => normalizeEdge(edge, edgeIndex))
    .filter((edge): edge is WorkflowEdge => edge !== null)
    .filter((edge) => edge.source.nodeId !== edge.target.nodeId && portIds.get(edge.source.nodeId)?.has(edge.source.portId) && portIds.get(edge.target.nodeId)?.has(edge.target.portId))
  const positionRecord = asRecord(record?.viewport)
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, numberValue(positionRecord?.zoom, 1)))
  const id = stringValue(record?.id, '').trim() || createId(`flow-${index}`)
  const inputPorts = Array.isArray(record?.inputs) ? record.inputs.map((port, portIndex) => normalizePort(port, { id: `input-${portIndex}`, name: `输入 ${portIndex + 1}`, dataType: 'text' })).filter((port, portIndex, ports) => ports.findIndex((item) => item.id === port.id) === portIndex) : []
  const variables = Array.isArray(record?.variables) ? record.variables.map(normalizeVariable).filter((item): item is WorkflowVariable => item !== null) : []
  const entryNodeId = stringValue(asRecord(record?.settings)?.entryNodeId, '').trim()
  return {
    version: 1,
    id,
    name: stringValue(record?.name, '未命名流程').trim() || '未命名流程',
    description: stringValue(record?.description, ''),
    inputs: inputPorts,
    variables,
    nodes: uniqueNodes,
    edges,
    settings: {
      entryNodeId: entryNodeId && nodeIds.has(entryNodeId) ? entryNodeId : null,
      errorPolicy: asRecord(record?.settings)?.errorPolicy === 'continue' ? 'continue' : 'stop',
    },
    viewport: {
      x: numberValue(positionRecord?.x, 0),
      y: numberValue(positionRecord?.y, 0),
      zoom,
    },
    updatedAt: stringValue(record?.updatedAt, new Date().toISOString()),
  }
}

export function createEmptyWorkflow(name = '未命名流程'): WorkflowDocument {
  return {
    version: 1,
    id: createId('flow'),
    name,
    description: '',
    inputs: [],
    variables: [],
    nodes: [],
    edges: [],
    settings: { entryNodeId: null, errorPolicy: 'stop' },
    viewport: { x: 0, y: 0, zoom: 1 },
    updatedAt: new Date().toISOString(),
  }
}

export function normalizeWorkflowCanvas(input: unknown): WorkflowCanvasMetadata {
  const record = asRecord(input)
  const rawWorkflows = Array.isArray(record?.workflows) ? record.workflows : []
  const workflows = rawWorkflows.map(normalizeWorkflow)
  const normalizedWorkflows = workflows.length > 0 ? workflows : [createEmptyWorkflow()]
  const requestedActiveId = stringValue(record?.activeWorkflowId, '').trim()
  const activeWorkflowId = normalizedWorkflows.some((workflow) => workflow.id === requestedActiveId) ? requestedActiveId : normalizedWorkflows[0].id
  return { version: 1, activeWorkflowId, workflows: normalizedWorkflows }
}
