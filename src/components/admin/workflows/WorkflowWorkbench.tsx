'use client'

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { PageHeader, StatusMessage } from '@oxygen-design/patterns'
import { Badge, Button } from '@oxygen-design/ui'
import { Eye, Pencil, Play, RotateCcw, RotateCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addNode, duplicateWorkflow, getRunBlockReason, updateNode } from '@/lib/workflows/graph'
import { createEmptyWorkflow } from '@/lib/workflows/normalize'
import { createWorkflowSaveCoordinator, type WorkflowSaveState } from '@/lib/workflows/persistence'
import { createWorkflowRunSaveCoordinator, type WorkflowRunSaveState } from '@/lib/workflows/runPersistence'
import { saveWorkflowRuns } from '@/lib/workflows/runs'
import { saveWorkflowCanvas, saveWorkflowRuns as persistWorkflowRuns } from '@/lib/workflows/stateStore'
import { executeWorkflowNode } from '@/lib/workflows/client/execution'
import { advanceWorkflowAsync, cancelWorkflow, followWorkflowError, resolveWaiting, retryWorkflowNode, startWorkflow, type WorkflowAsyncStatus } from '@/lib/workflows/runtime'
import type { WorkflowCanvasMetadata, WorkflowDocument, WorkflowNode, WorkflowNodeKind, WorkflowRun, WorkflowRunMetadata, WorkflowValue, WorkflowValueMap } from '@/lib/workflows/types'
import { WorkflowInspector } from './WorkflowInspector'
import { WorkflowCanvas } from './WorkflowCanvas'
import { WorkflowPlayer } from './WorkflowPlayer'
import { WorkflowSidebar } from './WorkflowSidebar'

type WorkbenchMode = 'edit' | 'preview' | 'run'
type WorkbenchAction =
  | { type: 'set-active'; workflowId: string }
  | { type: 'replace'; metadata: WorkflowCanvasMetadata }
  | { type: 'upsert'; workflow: WorkflowDocument }
  | { type: 'add'; workflow: WorkflowDocument }
  | { type: 'remove'; workflowId: string }

function reducer(state: WorkflowCanvasMetadata, action: WorkbenchAction): WorkflowCanvasMetadata {
  if (action.type === 'set-active') return { ...state, activeWorkflowId: action.workflowId }
  if (action.type === 'replace') return action.metadata
  if (action.type === 'upsert') return { ...state, workflows: state.workflows.map((workflow) => workflow.id === action.workflow.id ? action.workflow : workflow) }
  if (action.type === 'add') return { ...state, activeWorkflowId: action.workflow.id, workflows: [...state.workflows, action.workflow] }
  const workflows = state.workflows.filter((workflow) => workflow.id !== action.workflowId)
  const activeWorkflowId = state.activeWorkflowId === action.workflowId ? workflows[0]?.id ?? null : state.activeWorkflowId
  return { ...state, activeWorkflowId, workflows: workflows.length > 0 ? workflows : [createEmptyWorkflow()] }
}

interface WorkflowWorkbenchProps {
  initialMetadata: WorkflowCanvasMetadata
  initialRuns: WorkflowRunMetadata
  userId: string
}

export function WorkflowWorkbench({ initialMetadata, initialRuns, userId }: WorkflowWorkbenchProps) {
  const [metadata, dispatch] = useReducer(reducer, initialMetadata)
  const metadataRef = useRef(initialMetadata)
  const [runMetadata, setRunMetadata] = useState(initialRuns)
  const runMetadataRef = useRef(initialRuns)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [mode, setMode] = useState<WorkbenchMode>('edit')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<WorkflowSaveState>({ pending: false, error: null })
  const [runSaveState, setRunSaveState] = useState<WorkflowRunSaveState>({ pending: false, error: null })
  const [executionStatus, setExecutionStatus] = useState<WorkflowAsyncStatus | null>(null)
  const executionControllerRef = useRef<AbortController | null>(null)
  const executionKeyRef = useRef<string | null>(null)
  const saveCoordinator = useMemo(() => createWorkflowSaveCoordinator(async (nextMetadata) => {
    const { error } = await saveWorkflowCanvas(createClient(), userId, nextMetadata)
    return { error: error ? new Error(error) : null }
  }, 450, setSaveState), [userId])
  const runSaveCoordinator = useMemo(() => createWorkflowRunSaveCoordinator(async (nextRuns) => {
    const { error } = await persistWorkflowRuns(createClient(), userId, nextRuns)
    return { error: error ? new Error(error) : null }
  }, 450, setRunSaveState), [userId])
  useEffect(() => () => {
    saveCoordinator.dispose()
    runSaveCoordinator.dispose()
    executionControllerRef.current?.abort()
    executionKeyRef.current = null
  }, [runSaveCoordinator, saveCoordinator])
  const activeWorkflow = useMemo(() => metadata.workflows.find((workflow) => workflow.id === metadata.activeWorkflowId) ?? metadata.workflows[0], [metadata])
  const selectedNode = activeWorkflow?.nodes.find((node) => node.id === selectedNodeId) ?? null
  const activeRun = runMetadata.runs.find((run) => run.id === selectedRunId) ?? null
  const recoverableRuns = activeWorkflow ? runMetadata.runs.filter((run) => run.workflowId === activeWorkflow.id && (run.status === 'running' || run.status === 'waiting')) : []
  const readOnly = mode !== 'edit'
  const changeMode = (nextMode: WorkbenchMode) => {
    if (nextMode !== 'run') {
      executionControllerRef.current?.abort()
      executionControllerRef.current = null
      executionKeyRef.current = null
      setExecutionStatus(null)
    }
    setMode(nextMode)
  }

  const applyMetadata = (nextMetadata: WorkflowCanvasMetadata) => {
    metadataRef.current = nextMetadata
    dispatch({ type: 'replace', metadata: nextMetadata })
    saveCoordinator.schedule(nextMetadata)
  }

  const applyAction = (action: WorkbenchAction, nextNotice: string | null = null) => {
    applyMetadata(reducer(metadataRef.current, action))
    setNotice(nextNotice)
  }

  const updateActiveWorkflow = (workflow: WorkflowDocument) => applyMetadata({ ...metadataRef.current, workflows: metadataRef.current.workflows.map((item) => item.id === workflow.id ? workflow : item) })
  const createWorkflow = () => applyAction({ type: 'add', workflow: createEmptyWorkflow(`我的流程 ${metadataRef.current.workflows.length + 1}`) })
  const updateWithNotice = (action: WorkbenchAction, nextNotice: string | null) => {
    applyAction(action, nextNotice)
  }

  const applyRunMetadata = (nextRuns: WorkflowRunMetadata, selectedRun: WorkflowRun | null = null) => {
    runMetadataRef.current = nextRuns
    setRunMetadata(nextRuns)
    if (selectedRun) setSelectedRunId(selectedRun.id)
    runSaveCoordinator.schedule(nextRuns)
  }

  const persistRun = (nextRun: WorkflowRun) => applyRunMetadata(saveWorkflowRuns(runMetadataRef.current, nextRun), nextRun)

  const executeRun = (run: WorkflowRun, workflow: WorkflowDocument) => {
    executionControllerRef.current?.abort()
    const controller = new AbortController()
    executionControllerRef.current = controller
    const executionKey = `${run.id}:${run.currentNodeId ?? 'none'}:${Date.now()}`
    executionKeyRef.current = executionKey
    setExecutionStatus('executing')
    void advanceWorkflowAsync(run, workflow, async (input) => {
      const result = await executeWorkflowNode(input, controller.signal)
      return result.ok
        ? { ok: true, output: result.output, variables: result.variables }
        : { ok: false, error: result.error, retryable: result.retryable }
    }, { onStatus: (status) => { if (executionKeyRef.current === executionKey) setExecutionStatus(status) }, signal: controller.signal }).then((nextRun) => {
      if (executionKeyRef.current !== executionKey) return
      setExecutionStatus(null)
      executionControllerRef.current = null
      persistRun(nextRun)
    }).catch(() => {
      if (executionKeyRef.current !== executionKey) return
      setExecutionStatus(null)
      executionControllerRef.current = null
      setNotice('AI 执行失败，请稍后重试。')
    })
  }

  const handleStartRun = (inputs: WorkflowValueMap) => {
    if (!activeWorkflow) return
    const started = startWorkflow(activeWorkflow, inputs)
    persistRun(started)
    if (started.status === 'running') executeRun(started, activeWorkflow)
  }

  const handleResolveRun = (response: WorkflowValue) => {
    if (!activeWorkflow || !activeRun) return
    const resolved = resolveWaiting(activeRun, response)
    persistRun(resolved)
    if (resolved.status === 'running') executeRun(resolved, activeWorkflow)
  }

  const handleResumeRun = (runId: string) => {
    if (!activeWorkflow) return
    const run = runMetadataRef.current.runs.find((item) => item.id === runId)
    if (!run || run.workflowId !== activeWorkflow.id) return
    if (run.status !== 'running') {
      persistRun(run)
      return
    }
    persistRun(run)
    executeRun(run, activeWorkflow)
  }

  const handleCancelRun = () => {
    executionControllerRef.current?.abort()
    executionControllerRef.current = null
    executionKeyRef.current = null
    setExecutionStatus(null)
    if (activeRun) persistRun(cancelWorkflow(activeRun))
  }

  const handleRetryCurrentNode = () => {
    if (!activeWorkflow || !activeRun) return
    const retried = retryWorkflowNode(activeRun)
    if (retried === activeRun) return
    persistRun(retried)
    executeRun(retried, activeWorkflow)
  }

  const handleFollowErrorBranch = () => {
    if (!activeWorkflow || !activeRun) return
    const branched = followWorkflowError(activeRun, activeWorkflow)
    if (branched === activeRun) {
      setNotice('当前节点没有配置错误分支。')
      return
    }
    persistRun(branched)
    executeRun(branched, activeWorkflow)
  }

  const handleAddNode = (kind: WorkflowNodeKind, subtype: string, title: string) => {
    if (readOnly || !activeWorkflow) return
    const next = addNode(activeWorkflow, { kind, subtype, title, position: { x: 80 + activeWorkflow.nodes.length * 28, y: 100 + activeWorkflow.nodes.length * 22 } })
    updateActiveWorkflow(next)
    setSelectedNodeId(next.nodes[next.nodes.length - 1].id)
    setSelectedNodeIds([next.nodes[next.nodes.length - 1].id])
  }

  const handleRename = (workflowId: string, name: string) => {
    const workflow = metadataRef.current.workflows.find((item) => item.id === workflowId)
    if (workflow) updateActiveWorkflow({ ...workflow, name, updatedAt: new Date().toISOString() })
  }

  const handleDuplicate = (workflowId: string) => {
    const workflow = metadataRef.current.workflows.find((item) => item.id === workflowId)
    if (workflow) updateWithNotice({ type: 'add', workflow: duplicateWorkflow(workflow) }, null)
  }

  const handleDelete = (workflowId: string) => {
    if (metadataRef.current.workflows.length <= 1) {
      setNotice('至少保留一个流程。')
      return
    }
    updateWithNotice({ type: 'remove', workflowId }, null)
    setSelectedNodeId(null)
    setSelectedNodeIds([])
  }

  const handleUpdateNode = (nodeId: string, patch: Partial<Pick<WorkflowNode, 'title' | 'description' | 'color' | 'execution' | 'config'>>) => {
    if (readOnly || !activeWorkflow) return
    updateActiveWorkflow(updateNode(activeWorkflow, nodeId, patch))
  }

  const handleUpdateNodeTitle = (nodeId: string, title: string) => handleUpdateNode(nodeId, { title })

  const runReason = mode === 'run' && activeWorkflow ? getRunBlockReason(activeWorkflow) : null
  const saveLabel = saveState.error ? '保存失败，重试' : saveState.pending ? '保存中' : '已保存'
  const runSaveLabel = runSaveState.error ? '运行保存失败，重试' : runSaveState.pending ? '运行保存中' : runMetadata.activeRunId ? '运行已保存' : null

  return (
    <div className="sg-workflow-page" data-workflow-user={userId}>
      <PageHeader
        className="sg-workflow-header"
        title="流程工作台"
        description="把思考方式画出来，再逐步变成可执行流程。"
        actions={
          <div className="sg-workflow-header__actions">
            <div className="sg-workflow-mode-switch" role="group" aria-label="工作模式">
              <Button type="button" size="sm" variant={mode === 'edit' ? 'secondary' : 'ghost'} onClick={() => changeMode('edit')}><Pencil aria-hidden size={14} />编辑</Button>
              <Button type="button" size="sm" variant={mode === 'preview' ? 'secondary' : 'ghost'} onClick={() => changeMode('preview')}><Eye aria-hidden size={14} />预览</Button>
              <Button type="button" size="sm" variant={mode === 'run' ? 'secondary' : 'ghost'} onClick={() => changeMode('run')}><Play aria-hidden size={14} />运行</Button>
            </div>
            {saveState.error ? (
              <Button type="button" variant="link" size="sm" role="status" onClick={() => saveCoordinator.retry()}>
                {saveLabel}
              </Button>
            ) : (
              <Badge variant="secondary" role="status">{notice ?? saveLabel}</Badge>
            )}
            {runSaveState.error ? (
              <Button type="button" variant="link" size="sm" role="status" onClick={() => runSaveCoordinator.retry()}>
                {runSaveLabel}
              </Button>
            ) : runSaveLabel ? (
              <Badge variant="success" role="status">{runSaveLabel}</Badge>
            ) : null}
          </div>
        }
      />

      <div className="sg-workflow-layout">
         <WorkflowSidebar workflows={metadata.workflows} activeWorkflowId={activeWorkflow?.id ?? null} onSelectWorkflow={(workflowId) => { applyAction({ type: 'set-active', workflowId }); setSelectedNodeId(null); setSelectedNodeIds([]); setSelectedRunId(null) }} onCreateWorkflow={createWorkflow} onRenameWorkflow={handleRename} onDuplicateWorkflow={handleDuplicate} onDeleteWorkflow={handleDelete} onAddNode={handleAddNode} onUnavailable={setNotice} />
        <main className={`sg-workflow-canvas-shell${readOnly ? ' sg-workflow-canvas-shell--readonly' : ''}`} aria-label="流程画布" role="application">
          <div className="sg-workflow-canvas-toolbar"><span>{activeWorkflow?.name ?? '未命名流程'}</span><div className="sg-workflow-canvas-tools"><button type="button" className="sg-icon-btn" aria-label="撤销" title="撤销"><RotateCcw aria-hidden size={15} /></button><button type="button" className="sg-icon-btn" aria-label="重做" title="重做"><RotateCw aria-hidden size={15} /></button></div></div>
           {mode === 'run' && activeWorkflow ? <WorkflowPlayer workflow={activeWorkflow} run={activeRun} recoverableRuns={recoverableRuns} onStart={handleStartRun} onResolve={handleResolveRun} onResume={handleResumeRun} onCancel={handleCancelRun} onRetrySave={() => runSaveCoordinator.retry()} saveError={runSaveState.error} executionStatus={executionStatus} canRetryCurrentNode={Boolean(activeRun?.currentNodeId && activeWorkflow.nodes.some((node) => node.id === activeRun.currentNodeId && node.kind === 'ai' && node.execution.mode === 'configured' && node.execution.provider === 'ai'))} canFollowErrorBranch={Boolean(activeRun?.currentNodeId && activeWorkflow.edges.some((edge) => edge.source.nodeId === activeRun.currentNodeId && edge.source.portId === 'error'))} onRetryCurrentNode={handleRetryCurrentNode} onFollowErrorBranch={handleFollowErrorBranch} /> : activeWorkflow?.nodes.length ? <WorkflowCanvas workflow={activeWorkflow} selectedNodeId={selectedNodeId} selectedNodeIds={selectedNodeIds} mode={mode} onSelectNode={(nodeId, additive) => { setSelectedNodeIds((current) => additive ? current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId] : [nodeId]); setSelectedNodeId(nodeId) }} onUpdateWorkflow={updateActiveWorkflow} onUpdateNodeTitle={handleUpdateNodeTitle} onRunBlock={setNotice} /> : <div className="sg-workflow-empty-canvas"><strong>从一个想法开始</strong><span>从左侧选择节点，或新建一个空白流程。</span><Button type="button" onClick={createWorkflow}>新建空白流程</Button></div>}
           {runReason ? <StatusMessage className="sg-workflow-run-block" tone="error">{runReason}</StatusMessage> : null}
        </main>
        <WorkflowInspector node={selectedNode} readOnly={readOnly} onUpdateNode={handleUpdateNode} />
      </div>
    </div>
  )
}
