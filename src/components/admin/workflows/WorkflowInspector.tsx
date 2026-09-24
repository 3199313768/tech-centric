'use client'

import { normalizeWorkflowAiConfig } from '@/lib/workflows/normalize'
import type { WorkflowAiConfig, WorkflowNode, WorkflowNodeColor, WorkflowNodeExecution, WorkflowNodeKind } from '@/lib/workflows/types'

interface WorkflowInspectorProps {
  node: WorkflowNode | null
  readOnly: boolean
  onUpdateNode: (nodeId: string, patch: Partial<Pick<WorkflowNode, 'title' | 'description' | 'color' | 'execution' | 'config'>>) => void
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
  const aiConfig: WorkflowAiConfig = normalizeWorkflowAiConfig(node.config.ai) ?? {
    provider: 'deepseek',
    systemPrompt: '',
    promptTemplate: '请处理：{{inputs.text}}',
    temperature: 0.2,
    responseFormat: 'text',
    outputVariable: 'ai_output',
    maxRetries: 2,
    timeoutMs: 30_000,
  }
  const updateAiConfig = (patch: Partial<WorkflowAiConfig>) => onUpdateNode(node.id, { config: { ...node.config, ai: { ...aiConfig, ...patch } } })

  return (
    <aside className="sg-workflow-inspector" aria-label="节点属性">
      <div className="sg-workflow-inspector__heading"><div><span className="sg-workflow-eyebrow">节点属性</span><h2>{node.title}</h2></div><span className={`sg-workflow-kind sg-workflow-kind--${node.kind}`}>{KIND_LABELS[node.kind]}</span></div>
      <label className="sg-workflow-field"><span>名称</span><input className="sg-form-input" value={node.title} disabled={readOnly} onChange={(event) => onUpdateNode(node.id, { title: event.target.value })} /></label>
      <label className="sg-workflow-field"><span>说明</span><textarea className="sg-form-textarea" rows={5} value={node.description} disabled={readOnly} onChange={(event) => onUpdateNode(node.id, { description: event.target.value })} /></label>
      <label className="sg-workflow-field"><span>类型</span><input className="sg-form-input" value={`${KIND_LABELS[node.kind]} · ${node.subtype}`} disabled readOnly /></label>
      <div className="sg-workflow-field"><span>节点颜色</span><div className="sg-workflow-color-list">{COLORS.map((color) => <button type="button" key={color} className={`sg-workflow-color sg-workflow-color--${color}${node.color === color ? ' sg-workflow-color--active' : ''}`} aria-label={`颜色：${color}`} disabled={readOnly} onClick={() => onUpdateNode(node.id, { color })} />)}</div></div>
      <label className="sg-workflow-field"><span>执行方式</span><select className="sg-form-input" value={node.execution.mode} disabled={readOnly} onChange={(event) => updateExecution(event.target.value as WorkflowNodeExecution['mode'])}><option value="manual">人工/仅记录</option><option value="configured">已配置</option><option value="disabled">暂不执行</option></select></label>
      {node.kind === 'ai' ? <div className="sg-workflow-inspector__ai-config">
        <div className="sg-workflow-inspector__section-title">AI 执行配置</div>
        <label className="sg-workflow-field"><span>服务提供方</span><select className="sg-form-input" value={aiConfig.provider} disabled><option value="deepseek">DeepSeek</option></select></label>
        <label className="sg-workflow-field"><span>系统提示词</span><textarea className="sg-form-textarea" rows={4} value={aiConfig.systemPrompt} disabled={readOnly} onChange={(event) => updateAiConfig({ systemPrompt: event.target.value })} /></label>
        <label className="sg-workflow-field"><span>Prompt 模板</span><textarea className="sg-form-textarea" rows={5} value={aiConfig.promptTemplate} disabled={readOnly} onChange={(event) => updateAiConfig({ promptTemplate: event.target.value })} /></label>
        <label className="sg-workflow-field"><span>输出格式</span><select className="sg-form-input" value={aiConfig.responseFormat} disabled={readOnly} onChange={(event) => updateAiConfig({ responseFormat: event.target.value as WorkflowAiConfig['responseFormat'] })}><option value="text">文本</option><option value="json">JSON</option></select></label>
        <label className="sg-workflow-field"><span>输出变量</span><input className="sg-form-input" value={aiConfig.outputVariable} disabled={readOnly} onChange={(event) => updateAiConfig({ outputVariable: event.target.value })} /></label>
        <label className="sg-workflow-field"><span>温度</span><input className="sg-form-input" type="number" min="0" max="2" step="0.1" value={aiConfig.temperature} disabled={readOnly} onChange={(event) => updateAiConfig({ temperature: Number(event.target.value) })} /></label>
        <label className="sg-workflow-field"><span>最大重试</span><input className="sg-form-input" type="number" min="0" max="2" step="1" value={aiConfig.maxRetries} disabled={readOnly} onChange={(event) => updateAiConfig({ maxRetries: Number(event.target.value) })} /></label>
        <label className="sg-workflow-field"><span>超时（毫秒）</span><input className="sg-form-input" type="number" min="5000" max="60000" step="1000" value={aiConfig.timeoutMs} disabled={readOnly} onChange={(event) => updateAiConfig({ timeoutMs: Number(event.target.value) })} /></label>
      </div> : null}
      {node.kind !== 'ai' && node.execution.mode === 'configured' ? <p className="sg-workflow-inspector__notice">当前节点的外部执行能力尚未接入。</p> : null}
      {node.kind === 'ai' && node.execution.mode === 'configured' ? <p className="sg-workflow-inspector__notice">AI 请求由服务端统一执行，账号元数据中不会保存密钥。</p> : null}
      {node.execution.mode === 'disabled' ? <p className="sg-workflow-inspector__notice sg-workflow-inspector__notice--muted">运行时会在此节点阻断，并说明原因。</p> : null}
    </aside>
  )
}
