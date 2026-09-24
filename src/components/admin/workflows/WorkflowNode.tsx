'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { WorkflowNode as WorkflowNodeData, WorkflowNodeColor, WorkflowPort } from '@/lib/workflows/types'

interface WorkflowNodeProps {
  node: WorkflowNodeData
  selected: boolean
  readOnly: boolean
  onSelect: (nodeId: string, additive: boolean) => void
  onMove: (nodeId: string, delta: { x: number; y: number }) => void
  onUpdateTitle: (nodeId: string, title: string) => void
  onStartConnection: (nodeId: string, portId: string) => void
  onCompleteConnection: (nodeId: string, portId: string) => void
}

const KIND_LABELS: Record<WorkflowNodeData['kind'], string> = {
  thinking: '思维',
  human: '人工',
  ai: 'AI',
  system: '系统',
  control: '控制',
}

export function WorkflowNode({ node, selected, readOnly, onSelect, onMove, onUpdateTitle, onStartConnection, onCompleteConnection }: WorkflowNodeProps) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(node.title)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)

  const finishTitle = () => {
    const nextTitle = draftTitle.trim()
    setEditing(false)
    if (nextTitle && nextTitle !== node.title) onUpdateTitle(node.id, nextTitle)
    else setDraftTitle(node.title)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (readOnly || event.target instanceof HTMLElement && event.target.closest('button, input')) return
    event.preventDefault()
    onSelect(node.id, event.shiftKey)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    const delta = { x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y }
    if (delta.x === 0 && delta.y === 0) return
    dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY }
    onMove(node.id, delta)
  }

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const renderAnchor = (port: WorkflowPort, side: 'input' | 'output') => (
    <button
      key={`${side}-${port.id}`}
      type="button"
      className={`sg-workflow-node__anchor sg-workflow-node__anchor--${side}`}
      aria-label={`连接${side === 'input' ? '输入' : '输出'}：${port.name}`}
      title={port.name}
      disabled={readOnly}
      onPointerDown={(event) => { event.stopPropagation(); if (side === 'output') onStartConnection(node.id, port.id) }}
      onPointerUp={(event) => { event.stopPropagation(); if (side === 'input') onCompleteConnection(node.id, port.id) }}
    />
  )

  const color = node.color as WorkflowNodeColor
  return (
    <article
      className={`sg-workflow-node sg-workflow-node--${color}${selected ? ' sg-workflow-node--selected' : ''}`}
      style={{ left: node.position.x, top: node.position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClick={(event) => onSelect(node.id, event.shiftKey)}
      data-node-id={node.id}
    >
      <div className="sg-workflow-node__meta"><span>{KIND_LABELS[node.kind]}</span><span>{node.subtype}</span></div>
      {editing && !readOnly ? <input autoFocus className="sg-workflow-node__title-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onBlur={finishTitle} onKeyDown={(event) => { if (event.key === 'Enter') finishTitle(); if (event.key === 'Escape') { setDraftTitle(node.title); setEditing(false) } }} /> : <button type="button" className="sg-workflow-node__title" onDoubleClick={(event) => { event.stopPropagation(); if (!readOnly) { setDraftTitle(node.title); setEditing(true) } }} onClick={(event) => event.stopPropagation()}>{node.title}</button>}
      {node.description ? <p className="sg-workflow-node__description">{node.description}</p> : <p className="sg-workflow-node__description sg-workflow-node__description--empty">双击标题编辑</p>}
      <div className="sg-workflow-node__anchors sg-workflow-node__anchors--inputs">{node.inputs.map((port) => renderAnchor(port, 'input'))}</div>
      <div className="sg-workflow-node__anchors sg-workflow-node__anchors--outputs">{node.outputs.map((port) => <span className="sg-workflow-node__port" key={port.id}><span>{port.name}</span>{renderAnchor(port, 'output')}</span>)}</div>
    </article>
  )
}
