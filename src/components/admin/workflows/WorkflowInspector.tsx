'use client'

import type { WorkflowNode, WorkflowNodeColor, WorkflowNodeExecution, WorkflowNodeKind } from '@/lib/workflows/types'

interface WorkflowInspectorProps {
  node: WorkflowNode | null
  readOnly: boolean
  onUpdateNode: (nodeId: string, patch: Partial<Pick<WorkflowNode, 'title' | 'description' | 'color' | 'execution'>>) => void
}

const COLORS: WorkflowNodeColor[] = ['green', 'gold', 'rose', 'blue', 'slate']
const KIND_LABELS: Record<WorkflowNodeKind, string> = {
  thinking: '思维节点',
  human: '人工节点',
  ai: 'AI 节点',
  system: '系统节点',
  control: '控制节点',
}

export function WorkflowInspector({ node, readOnly, onUpdateNode }: WorkflowInspectorProps) {
  if (!node) {
    return <aside className="sg-workflow-inspector" aria-label="节点属性"><div className="sg-workflow-inspector__empty">选择一个节点查看属性</div></aside>
  }

  const updateExecution = (mode: WorkflowNodeExecution['mode']) => onUpdateNode(node.id, { execution: { ...node.execution, mode } })

  return (
    <aside className="sg-workflow-inspector" aria-label="节点属性">
      <div className="sg-workflow-inspector__heading"><div><span className="sg-workflow-eyebrow">节点属性</span><h2>{node.title}</h2></div><span className={`sg-workflow-kind sg-workflow-kind--${node.kind}`}>{KIND_LABELS[node.kind]}</span></div>
      <label className="sg-workflow-field"><span>名称</span><input className="sg-form-input" value={node.title} disabled={readOnly} onChange={(event) => onUpdateNode(node.id, { title: event.target.value })} /></label>
      <label className="sg-workflow-field"><span>说明</span><textarea className="sg-form-textarea" rows={5} value={node.description} disabled={readOnly} onChange={(event) => onUpdateNode(node.id, { description: event.target.value })} /></label>
      <label className="sg-workflow-field"><span>类型</span><input className="sg-form-input" value={`${KIND_LABELS[node.kind]} · ${node.subtype}`} disabled readOnly /></label>
      <div className="sg-workflow-field"><span>节点颜色</span><div className="sg-workflow-color-list">{COLORS.map((color) => <button type="button" key={color} className={`sg-workflow-color sg-workflow-color--${color}${node.color === color ? ' sg-workflow-color--active' : ''}`} aria-label={`颜色：${color}`} disabled={readOnly} onClick={() => onUpdateNode(node.id, { color })} />)}</div></div>
      <label className="sg-workflow-field"><span>执行方式</span><select className="sg-form-input" value={node.execution.mode} disabled={readOnly} onChange={(event) => updateExecution(event.target.value as WorkflowNodeExecution['mode'])}><option value="manual">人工/仅记录</option><option value="configured">已配置</option><option value="disabled">暂不执行</option></select></label>
      {node.execution.mode === 'configured' ? <p className="sg-workflow-inspector__notice">当前节点只有配置契约，真实 AI/API 执行将在后续阶段接入。</p> : null}
      {node.execution.mode === 'disabled' ? <p className="sg-workflow-inspector__notice sg-workflow-inspector__notice--muted">运行时会在此节点阻断，并说明原因。</p> : null}
    </aside>
  )
}
