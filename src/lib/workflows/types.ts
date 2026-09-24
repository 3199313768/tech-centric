export type WorkflowPortDataType = 'text' | 'number' | 'boolean' | 'json'
export type WorkflowNodeKind = 'thinking' | 'human' | 'ai' | 'system' | 'control'
export type WorkflowNodeColor = 'green' | 'gold' | 'rose' | 'blue' | 'slate'
export type WorkflowExecutionMode = 'manual' | 'configured' | 'disabled'
export type WorkflowExecutionProvider = 'ai' | 'http' | 'database' | 'file' | 'webhook'

export type WorkflowJsonValue = string | number | boolean | null | WorkflowJsonValue[] | { [key: string]: WorkflowJsonValue }
export type WorkflowJsonObject = { [key: string]: WorkflowJsonValue }

export type WorkflowAiConfig = {
  provider: 'deepseek'
  systemPrompt: string
  promptTemplate: string
  temperature: number
  responseFormat: 'text' | 'json'
  outputVariable: string
  maxRetries: number
  timeoutMs: number
}

export type WorkflowExecutionStatus = 'idle' | 'executing' | 'retrying'

export type WorkflowExecutionAttempt = {
  nodeId: string
  status: 'success' | 'failed'
  attempt: number
  retryable: boolean
  error: string | null
  at: string
}

export type WorkflowValue = WorkflowJsonValue
export type WorkflowValueMap = Record<string, WorkflowValue>

export type WorkflowRunStatus = 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'

export type WorkflowWaitingState = {
  nodeId: string
  kind: 'input' | 'confirm' | 'select'
  prompt: string
  options?: Array<{ value: string; label: string }>
}

export type WorkflowRunHistoryItem = {
  nodeId: string
  status: 'completed' | 'waiting' | 'failed'
  output?: WorkflowValueMap
  at: string
}

export type WorkflowRun = {
  version: 1
  id: string
  workflowId: string
  status: WorkflowRunStatus
  currentNodeId: string | null
  nextPortId: string | null
  inputs: WorkflowValueMap
  variables: WorkflowValueMap
  waiting: WorkflowWaitingState | null
  history: WorkflowRunHistoryItem[]
  error: string | null
  createdAt: string
  updatedAt: string
}

export type WorkflowRunMetadata = {
  version: 1
  activeRunId: string | null
  runs: WorkflowRun[]
}

export interface WorkflowPort {
  id: string
  name: string
  dataType: WorkflowPortDataType
  required?: boolean
  description?: string
}

export interface WorkflowPortRef {
  nodeId: string
  portId: string
}

export interface WorkflowVariable {
  id: string
  name: string
  dataType: WorkflowPortDataType
  value?: string
}

export interface WorkflowNodeExecution {
  mode: WorkflowExecutionMode
  provider?: WorkflowExecutionProvider
}

export interface WorkflowNode {
  id: string
  kind: WorkflowNodeKind
  subtype: string
  position: { x: number; y: number }
  title: string
  description: string
  color: WorkflowNodeColor
  config: WorkflowJsonObject
  inputs: WorkflowPort[]
  outputs: WorkflowPort[]
  execution: WorkflowNodeExecution
}

export interface WorkflowEdge {
  id: string
  source: WorkflowPortRef
  target: WorkflowPortRef
  condition?: { label: string; expression?: string }
}

export interface WorkflowDocument {
  version: 1
  id: string
  name: string
  description: string
  inputs: WorkflowPort[]
  variables: WorkflowVariable[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  settings: {
    entryNodeId: string | null
    errorPolicy: 'stop' | 'continue'
  }
  viewport: { x: number; y: number; zoom: number }
  updatedAt: string
}

export interface WorkflowCanvasMetadata {
  version: 1
  activeWorkflowId: string | null
  workflows: WorkflowDocument[]
}
