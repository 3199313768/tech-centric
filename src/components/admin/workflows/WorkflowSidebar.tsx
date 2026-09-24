'use client'

import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { WorkflowDocument, WorkflowNodeKind } from '@/lib/workflows/types'

const NODE_GROUPS: Array<{ label: string; items: Array<{ label: string; kind: WorkflowNodeKind; subtype: string }> }> = [
  { label: '思维', items: [
    { label: '问题', kind: 'thinking', subtype: 'question' },
    { label: '分析', kind: 'thinking', subtype: 'analysis' },
    { label: '结论', kind: 'thinking', subtype: 'conclusion' },
  ] },
  { label: '人工', items: [
    { label: '人工确认', kind: 'human', subtype: 'approval' },
    { label: '人工输入', kind: 'human', subtype: 'input' },
    { label: '人工选择', kind: 'human', subtype: 'select' },
  ] },
  { label: 'AI', items: [
    { label: 'AI 分析', kind: 'ai', subtype: 'analysis' },
    { label: 'AI 生成', kind: 'ai', subtype: 'generate' },
  ] },
  { label: '系统', items: [
    { label: 'API 调用', kind: 'system', subtype: 'http' },
    { label: '数据', kind: 'system', subtype: 'data' },
  ] },
  { label: '控制', items: [
    { label: '开始', kind: 'control', subtype: 'start' },
    { label: '判断', kind: 'control', subtype: 'decision' },
    { label: '循环', kind: 'control', subtype: 'loop' },
  ] },
]

interface WorkflowSidebarProps {
  workflows: WorkflowDocument[]
  activeWorkflowId: string | null
  onSelectWorkflow: (workflowId: string) => void
  onCreateWorkflow: () => void
  onRenameWorkflow: (workflowId: string, name: string) => void
  onDuplicateWorkflow: (workflowId: string) => void
  onDeleteWorkflow: (workflowId: string) => void
  onAddNode: (kind: WorkflowNodeKind, subtype: string, title: string) => void
  onUnavailable: (message: string) => void
}

export function WorkflowSidebar({
  workflows,
  activeWorkflowId,
  onSelectWorkflow,
  onCreateWorkflow,
  onRenameWorkflow,
  onDuplicateWorkflow,
  onDeleteWorkflow,
  onAddNode,
  onUnavailable,
}: WorkflowSidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const beginRename = (workflow: WorkflowDocument) => {
    setRenamingId(workflow.id)
    setRenameValue(workflow.name)
  }

  const finishRename = () => {
    if (renamingId && renameValue.trim()) onRenameWorkflow(renamingId, renameValue.trim())
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <aside className="sg-workflow-sidebar" aria-label="流程和节点">
      <section className="sg-workflow-sidebar__section">
        <div className="sg-workflow-sidebar__heading">
          <h2>我的流程</h2>
          <button type="button" className="sg-icon-btn" aria-label="新建空白流程" title="新建空白流程" onClick={onCreateWorkflow}><Plus aria-hidden size={16} /></button>
        </div>
        <div className="sg-workflow-list">
          {workflows.map((workflow) => (
            <div key={workflow.id} className={`sg-workflow-list__item${activeWorkflowId === workflow.id ? ' sg-workflow-list__item--active' : ''}`}>
              {renamingId === workflow.id ? <input autoFocus className="sg-workflow-list__rename" value={renameValue} aria-label="流程名称" onChange={(event) => setRenameValue(event.target.value)} onBlur={finishRename} onKeyDown={(event) => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') { setRenamingId(null); setRenameValue('') } }} /> : <button type="button" className="sg-workflow-list__select" onClick={() => onSelectWorkflow(workflow.id)} aria-current={activeWorkflowId === workflow.id ? 'page' : undefined}>{workflow.name}</button>}
              {activeWorkflowId === workflow.id ? (
                <span className="sg-workflow-list__actions">
                  <button type="button" className="sg-icon-btn sg-icon-btn--small" aria-label={`重命名流程：${workflow.name}`} title="重命名流程" onClick={() => beginRename(workflow)}>Aa</button>
                  <button type="button" className="sg-icon-btn sg-icon-btn--small" aria-label={`复制流程：${workflow.name}`} title="复制流程" onClick={() => onDuplicateWorkflow(workflow.id)}><Copy aria-hidden size={13} /></button>
                  <button type="button" className="sg-icon-btn sg-icon-btn--small" aria-label={`删除流程：${workflow.name}`} title="删除流程" onClick={() => onDeleteWorkflow(workflow.id)}><Trash2 aria-hidden size={13} /></button>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="sg-workflow-sidebar__section sg-workflow-sidebar__section--nodes">
        <div className="sg-workflow-sidebar__heading"><h2>节点</h2><span>拖到画布</span></div>
        {NODE_GROUPS.map((group) => (
          <div className="sg-workflow-node-group" key={group.label}>
            <h3>{group.label}</h3>
            <div className="sg-workflow-node-palette">
              {group.items.map((item) => (
                <button
                  type="button"
                  draggable
                  className="sg-workflow-node-palette__item"
                  key={`${item.kind}-${item.subtype}`}
                  onClick={() => onAddNode(item.kind, item.subtype, item.label)}
                  onDragStart={(event) => event.dataTransfer.setData('application/x-workflow-node', JSON.stringify(item))}
                >
                  <span aria-hidden className={`sg-workflow-node-palette__dot sg-workflow-node-palette__dot--${item.kind}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="sg-workflow-sidebar__section sg-workflow-sidebar__section--quick">
        <button type="button" className="sg-btn sg-btn--ghost" onClick={onCreateWorkflow}>新建空白流程</button>
        <button type="button" className="sg-btn sg-btn--ghost" onClick={() => onUnavailable('模板库将在后续阶段开放。')}>从模板开始</button>
        <button type="button" className="sg-btn sg-btn--ghost" onClick={() => onUnavailable('AI 搭流程将在后续阶段开放。')}>让 AI 生成流程</button>
      </section>
    </aside>
  )
}
