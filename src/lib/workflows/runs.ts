import type {
  WorkflowDocument,
  WorkflowRun,
  WorkflowRunHistoryItem,
  WorkflowRunMetadata,
  WorkflowRunStatus,
  WorkflowJsonValue,
  WorkflowValueMap,
  WorkflowWaitingState,
} from './types'

type UnknownRecord = Record<string, unknown>

const DEFAULT_MAX_RUNS = 20
const RUN_STATUSES: WorkflowRunStatus[] = ['running', 'waiting', 'completed', 'failed', 'cancelled']
const HISTORY_STATUSES: WorkflowRunHistoryItem['status'][] = ['completed', 'waiting', 'failed']

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : null
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function validTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback
}

function jsonValue(value: unknown, depth = 0): WorkflowJsonValue | undefined {
  if (depth > 4) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) {
    return value.slice(0, 32).map((item) => jsonValue(item, depth + 1)).filter((item): item is WorkflowJsonValue => item !== undefined)
  }
  const record = asRecord(value)
  if (!record) return undefined
  return Object.entries(record).slice(0, 64).reduce<Record<string, WorkflowJsonValue>>((result, [key, item]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(key)) return result
    const normalized = jsonValue(item, depth + 1)
    if (normalized !== undefined) result[key] = normalized
    return result
  }, {})
}

function normalizeValueMap(value: unknown): WorkflowValueMap {
  const record = asRecord(value)
  if (!record) return {}
  return Object.entries(record).reduce<WorkflowValueMap>((result, [key, item]) => {
    const normalized = jsonValue(item)
    if (normalized !== undefined) result[key] = normalized
    return result
  }, {})
}

function normalizeWaiting(value: unknown, currentNodeId: string): WorkflowWaitingState | null {
  const record = asRecord(value)
  if (!record || stringValue(record.nodeId, '') !== currentNodeId) return null
  const kind = record.kind === 'confirm' || record.kind === 'select' ? record.kind : record.kind === 'input' ? 'input' : null
  if (!kind) return null
  const options = Array.isArray(record.options)
    ? record.options.map((option) => {
        const item = asRecord(option)
        const optionValue = stringValue(item?.value, '').trim()
        const label = stringValue(item?.label, '').trim()
        return optionValue && label ? { value: optionValue, label } : null
      }).filter((option): option is { value: string; label: string } => option !== null)
    : undefined
  return {
    nodeId: currentNodeId,
    kind,
    prompt: stringValue(record.prompt, '请完成当前步骤'),
    ...(options && options.length > 0 ? { options } : {}),
  }
}

function normalizeHistory(value: unknown): WorkflowRunHistoryItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const record = asRecord(item)
    const nodeId = stringValue(record?.nodeId, '').trim()
    const status = HISTORY_STATUSES.includes(record?.status as WorkflowRunHistoryItem['status']) ? record?.status as WorkflowRunHistoryItem['status'] : null
    if (!nodeId || !status) return null
    return {
      nodeId,
      status,
      ...(record?.output ? { output: normalizeValueMap(record.output) } : {}),
      at: validTimestamp(record?.at, new Date(0).toISOString()),
    }
  }).filter((item): item is WorkflowRunHistoryItem => item !== null)
}

function workflowNodeIds(workflows: WorkflowDocument[]): Map<string, Set<string>> {
  return new Map(workflows.map((workflow) => [workflow.id, new Set(workflow.nodes.map((node) => node.id))]))
}

function normalizeRun(value: unknown, nodeIdsByWorkflow: Map<string, Set<string>>): WorkflowRun | null {
  const record = asRecord(value)
  if (!record) return null
  const id = stringValue(record.id, '').trim()
  const workflowId = stringValue(record.workflowId, '').trim()
  const status = RUN_STATUSES.includes(record.status as WorkflowRunStatus) ? record.status as WorkflowRunStatus : null
  const currentNodeId = typeof record.currentNodeId === 'string' && record.currentNodeId.trim() ? record.currentNodeId.trim() : null
  const nodeIds = nodeIdsByWorkflow.get(workflowId)
  if (!id || !workflowId || !status || !nodeIds || (currentNodeId !== null && !nodeIds.has(currentNodeId))) return null
  const waiting = status === 'waiting' && currentNodeId ? normalizeWaiting(record.waiting, currentNodeId) : null
  if (status === 'waiting' && !waiting) return null
  if (status === 'running' && currentNodeId === null) return null
  const now = new Date().toISOString()
  return {
    version: 1,
    id,
    workflowId,
    status,
    currentNodeId,
    nextPortId: typeof record.nextPortId === 'string' && record.nextPortId.trim() ? record.nextPortId.trim() : null,
    inputs: normalizeValueMap(record.inputs),
    variables: normalizeValueMap(record.variables),
    waiting,
    history: normalizeHistory(record.history),
    error: typeof record.error === 'string' ? record.error : null,
    createdAt: validTimestamp(record.createdAt, now),
    updatedAt: validTimestamp(record.updatedAt, now),
  }
}

export function normalizeWorkflowRuns(input: unknown, workflows: WorkflowDocument[]): WorkflowRunMetadata {
  const record = asRecord(input)
  const nodeIdsByWorkflow = workflowNodeIds(workflows)
  const rawRuns = Array.isArray(record?.runs) ? record.runs : []
  const uniqueIds = new Set<string>()
  const runs = rawRuns.map((run) => normalizeRun(run, nodeIdsByWorkflow)).filter((run): run is WorkflowRun => {
    if (!run || uniqueIds.has(run.id)) return false
    uniqueIds.add(run.id)
    return true
  })
  const requestedActiveId = stringValue(record?.activeRunId, '').trim()
  const activeRun = runs.find((run) => run.id === requestedActiveId && (run.status === 'running' || run.status === 'waiting'))
  return {
    version: 1,
    activeRunId: activeRun?.id ?? null,
    runs: limitRuns(runs, DEFAULT_MAX_RUNS),
  }
}

function limitRuns(runs: WorkflowRun[], maxRuns: number): WorkflowRun[] {
  const limit = Math.max(1, Math.floor(maxRuns))
  return [...runs]
    .sort((left, right) => {
      const leftActive = left.status === 'running' || left.status === 'waiting' ? 1 : 0
      const rightActive = right.status === 'running' || right.status === 'waiting' ? 1 : 0
      if (leftActive !== rightActive) return rightActive - leftActive
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    })
    .slice(0, limit)
}

export function saveWorkflowRuns(metadata: WorkflowRunMetadata, nextRun: WorkflowRun, maxRuns = DEFAULT_MAX_RUNS): WorkflowRunMetadata {
  const runs = metadata.runs.filter((run) => run.id !== nextRun.id)
  const limited = limitRuns([nextRun, ...runs], maxRuns)
  const activeRunId = nextRun.status === 'running' || nextRun.status === 'waiting' ? nextRun.id : metadata.activeRunId === nextRun.id ? null : metadata.activeRunId
  return { version: 1, activeRunId: limited.some((run) => run.id === activeRunId) ? activeRunId : null, runs: limited }
}

export function getRecoverableRun(metadata: WorkflowRunMetadata, workflowId: string): WorkflowRun | null {
  const run = metadata.runs.find((item) => item.id === metadata.activeRunId && item.workflowId === workflowId && (item.status === 'running' || item.status === 'waiting'))
  return run ?? null
}
