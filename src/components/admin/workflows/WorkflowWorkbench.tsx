'use client'

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Eye, Pencil, Play, RotateCcw, RotateCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addNode, duplicateWorkflow, getRunBlockReason, updateNode } from '@/lib/workflows/graph'
import { createEmptyWorkflow } from '@/lib/workflows/normalize'
import { createWorkflowSaveCoordinator, type WorkflowSaveState } from '@/lib/workflows/persistence'
import { createWorkflowRunSaveCoordinator, type WorkflowRunSaveState } from '@/lib/workflows/runPersistence'
import type { WorkflowCanvasMetadata, WorkflowDocument, WorkflowNode, WorkflowNodeKind, WorkflowRunMetadata } from '@/lib/workflows/types'
import { WorkflowInspector } from './WorkflowInspector'
import { WorkflowCanvas } from './WorkflowCanvas'
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
  const [runMetadata] = useState(initialRuns)
  const [mode, setMode] = useState<WorkbenchMode>('edit')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<WorkflowSaveState>({ pending: false, error: null })
  const [runSaveState, setRunSaveState] = useState<WorkflowRunSaveState>({ pending: false, error: null })
  const saveCoordinator = useMemo(() => createWorkflowSaveCoordinator(async (nextMetadata) => {
    const { error } = await createClient().auth.updateUser({ data: { workflow_canvas: nextMetadata } })
    return { error: error ? new Error(error.message) : null }
  }, 450, setSaveState), [])
  const runSaveCoordinator = useMemo(() => createWorkflowRunSaveCoordinator(async (nextRuns) => {
    const { error } = await createClient().auth.updateUser({ data: { workflow_runs: nextRuns } })
    return { error: error ? new Error(error.message) : null }
  }, 450, setRunSaveState), [])
  useEffect(() => () => {
    saveCoordinator.dispose()
    runSaveCoordinator.dispose()
  }, [runSaveCoordinator, saveCoordinator])
  const activeWorkflow = useMemo(() => metadata.workflows.find((workflow) => workflow.id === metadata.activeWorkflowId) ?? metadata.workflows[0], [metadata])
  const selectedNode = activeWorkflow?.nodes.find((node) => node.id === selectedNodeId) ?? null
  const readOnly = mode !== 'edit'

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

  const handleUpdateNode = (nodeId: string, patch: Partial<Pick<WorkflowNode, 'title' | 'description' | 'color' | 'execution'>>) => {
    if (readOnly || !activeWorkflow) return
    updateActiveWorkflow(updateNode(activeWorkflow, nodeId, patch))
  }

  const handleUpdateNodeTitle = (nodeId: string, title: string) => handleUpdateNode(nodeId, { title })

  const runReason = mode === 'run' && activeWorkflow ? getRunBlockReason(activeWorkflow) : null
  const saveLabel = saveState.error ? '保存失败，重试' : saveState.pending ? '保存中' : '已保存'
  const runSaveLabel = runSaveState.error ? '运行保存失败，重试' : runSaveState.pending ? '运行保存中' : runMetadata.activeRunId ? '运行已保存' : null

  return (
    <div className="sg-workflow-page" data-workflow-user={userId}>
      <header className="sg-workflow-header">
        <div><p className="sg-admin-eyebrow">WORKFLOW WORKBENCH</p><h1>流程工作台</h1><p>把思考方式画出来，再逐步变成可执行流程。</p></div>
        <div className="sg-workflow-header__actions">
          <div className="sg-segmented" role="group" aria-label="工作模式">
            <button type="button" className={mode === 'edit' ? 'sg-segmented__item sg-segmented__item--active' : 'sg-segmented__item'} onClick={() => setMode('edit')}><Pencil aria-hidden size={14} />编辑</button>
            <button type="button" className={mode === 'preview' ? 'sg-segmented__item sg-segmented__item--active' : 'sg-segmented__item'} onClick={() => setMode('preview')}><Eye aria-hidden size={14} />预览</button>
            <button type="button" className={mode === 'run' ? 'sg-segmented__item sg-segmented__item--active' : 'sg-segmented__item'} onClick={() => setMode('run')}><Play aria-hidden size={14} />运行</button>
          </div>
           {saveState.error ? <button type="button" className="sg-workflow-save-status sg-workflow-save-status--error" role="status" onClick={() => saveCoordinator.retry()}>{saveLabel}</button> : <span className="sg-workflow-save-status" role="status">{notice ?? saveLabel}</span>}
           {runSaveState.error ? <button type="button" className="sg-workflow-save-status sg-workflow-save-status--error" role="status" onClick={() => runSaveCoordinator.retry()}>{runSaveLabel}</button> : runSaveLabel ? <span className="sg-workflow-save-status" role="status">{runSaveLabel}</span> : null}
        </div>
      </header>

      <div className="sg-workflow-layout">
         <WorkflowSidebar workflows={metadata.workflows} activeWorkflowId={activeWorkflow?.id ?? null} onSelectWorkflow={(workflowId) => { applyAction({ type: 'set-active', workflowId }); setSelectedNodeId(null); setSelectedNodeIds([]) }} onCreateWorkflow={createWorkflow} onRenameWorkflow={handleRename} onDuplicateWorkflow={handleDuplicate} onDeleteWorkflow={handleDelete} onAddNode={handleAddNode} onUnavailable={setNotice} />
        <main className={`sg-workflow-canvas-shell${readOnly ? ' sg-workflow-canvas-shell--readonly' : ''}`} aria-label="流程画布" role="application">
          <div className="sg-workflow-canvas-toolbar"><span>{activeWorkflow?.name ?? '未命名流程'}</span><div className="sg-workflow-canvas-tools"><button type="button" className="sg-icon-btn" aria-label="撤销" title="撤销"><RotateCcw aria-hidden size={15} /></button><button type="button" className="sg-icon-btn" aria-label="重做" title="重做"><RotateCw aria-hidden size={15} /></button></div></div>
          {activeWorkflow?.nodes.length ? <WorkflowCanvas workflow={activeWorkflow} selectedNodeId={selectedNodeId} selectedNodeIds={selectedNodeIds} mode={mode} onSelectNode={(nodeId, additive) => { setSelectedNodeIds((current) => additive ? current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId] : [nodeId]); setSelectedNodeId(nodeId) }} onUpdateWorkflow={updateActiveWorkflow} onUpdateNodeTitle={handleUpdateNodeTitle} onRunBlock={setNotice} /> : <div className="sg-workflow-empty-canvas"><strong>从一个想法开始</strong><span>从左侧选择节点，或新建一个空白流程。</span><button type="button" className="sg-btn sg-btn--primary" onClick={createWorkflow}>新建空白流程</button></div>}
          {runReason ? <p className="sg-workflow-run-block" role="alert">{runReason}</p> : null}
        </main>
        <WorkflowInspector node={selectedNode} readOnly={readOnly} onUpdateNode={handleUpdateNode} />
      </div>
    </div>
  )
}
