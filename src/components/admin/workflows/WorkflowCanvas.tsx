'use client'

import { useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { addEdge, addNode, moveNodes } from '@/lib/workflows/graph'
import type { WorkflowDocument, WorkflowNode, WorkflowNodeKind } from '@/lib/workflows/types'
import { WorkflowNode as WorkflowNodeCard } from './WorkflowNode'

interface WorkflowCanvasProps {
  workflow: WorkflowDocument
  selectedNodeId: string | null
  selectedNodeIds: string[]
  mode: 'edit' | 'preview' | 'run'
  onSelectNode: (nodeId: string, additive: boolean) => void
  onUpdateWorkflow: (workflow: WorkflowDocument) => void
  onUpdateNodeTitle: (nodeId: string, title: string) => void
  onRunBlock: (message: string | null) => void
}

interface PanState {
  pointerId: number
  x: number
  y: number
  originX: number
  originY: number
}

const CANVAS_WIDTH = 2200
const CANVAS_HEIGHT = 1400

export function WorkflowCanvas({ workflow, selectedNodeId, selectedNodeIds, mode, onSelectNode, onUpdateWorkflow, onUpdateNodeTitle, onRunBlock }: WorkflowCanvasProps) {
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string; portId: string } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<PanState | null>(null)
  const readOnly = mode !== 'edit'

  const handlePanStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: workflow.viewport.x, originY: workflow.viewport.y }
  }

  const handlePanMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current || panRef.current.pointerId !== event.pointerId) return
    onUpdateWorkflow({ ...workflow, viewport: { ...workflow.viewport, x: panRef.current.originX + event.clientX - panRef.current.x, y: panRef.current.originY + event.clientY - panRef.current.y } })
  }

  const handlePanEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleMove = (nodeId: string, delta: { x: number; y: number }) => {
    if (readOnly) return
    const nodeIds = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId]
    onUpdateWorkflow(moveNodes(workflow, nodeIds, { x: delta.x / workflow.viewport.zoom, y: delta.y / workflow.viewport.zoom }))
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (readOnly || !canvasRef.current) return
    const payload = event.dataTransfer.getData('application/x-workflow-node')
    if (!payload) return
    try {
      const item = JSON.parse(payload) as { kind: WorkflowNodeKind; subtype: string; label: string }
      const rect = canvasRef.current.getBoundingClientRect()
      const position = { x: (event.clientX - rect.left - workflow.viewport.x) / workflow.viewport.zoom, y: (event.clientY - rect.top - workflow.viewport.y) / workflow.viewport.zoom }
      onUpdateWorkflow(addNode(workflow, { kind: item.kind, subtype: item.subtype, title: item.label, position }))
    } catch {
      onRunBlock('节点数据格式无法识别。')
    }
  }

  const changeZoom = (delta: number) => onUpdateWorkflow({ ...workflow, viewport: { ...workflow.viewport, zoom: Math.min(2, Math.max(0.35, workflow.viewport.zoom + delta)) } })
  const fitCanvas = () => onUpdateWorkflow({ ...workflow, viewport: { x: 20, y: 20, zoom: 0.75 } })

  const nodeCenter = (node: WorkflowNode) => ({ x: node.position.x + 90, y: node.position.y + 58 })
  const getNode = (nodeId: string) => workflow.nodes.find((node) => node.id === nodeId)
  const runBlock = mode === 'run' && workflow.nodes.some((node) => node.execution.mode === 'disabled')

  return (
    <div className={`sg-workflow-canvas${readOnly ? ' sg-workflow-canvas--readonly' : ''}`} ref={canvasRef} aria-label="画布" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} onPointerDown={handlePanStart} onPointerMove={handlePanMove} onPointerUp={handlePanEnd} onPointerCancel={handlePanEnd}>
      <div className="sg-workflow-canvas__toolbar"><button type="button" className="sg-icon-btn" aria-label="缩小" title="缩小" onClick={() => changeZoom(-0.1)} disabled={readOnly}><Minus aria-hidden size={15} /></button><span>{Math.round(workflow.viewport.zoom * 100)}%</span><button type="button" className="sg-icon-btn" aria-label="放大" title="放大" onClick={() => changeZoom(0.1)} disabled={readOnly}><Plus aria-hidden size={15} /></button><button type="button" className="sg-icon-btn" aria-label="适配画布" title="适配画布" onClick={fitCanvas}><Maximize aria-hidden size={15} /></button></div>
      <div className="sg-workflow-canvas__surface" style={{ transform: `translate(${workflow.viewport.x}px, ${workflow.viewport.y}px) scale(${workflow.viewport.zoom})`, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        <svg className="sg-workflow-edges" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-hidden>
          {workflow.edges.map((edge) => {
            const source = getNode(edge.source.nodeId)
            const target = getNode(edge.target.nodeId)
            if (!source || !target) return null
            const from = nodeCenter(source)
            const to = nodeCenter(target)
            const middle = (from.x + to.x) / 2
            return <path key={edge.id} d={`M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`} />
          })}
        </svg>
         {workflow.nodes.map((node) => <WorkflowNodeCard key={node.id} node={node} selected={node.id === selectedNodeId || selectedNodeIds.includes(node.id)} readOnly={readOnly} onSelect={onSelectNode} onMove={handleMove} onUpdateTitle={onUpdateNodeTitle} onStartConnection={(nodeId, portId) => setConnectionStart({ nodeId, portId })} onCompleteConnection={(nodeId, portId) => { if (connectionStart && connectionStart.nodeId !== nodeId) onUpdateWorkflow(addEdge(workflow, connectionStart, { nodeId, portId })); setConnectionStart(null) }} />)}
      </div>
      {runBlock ? <p className="sg-workflow-run-block" role="alert">运行会在未配置节点处阻断，请先完成节点配置。</p> : null}
    </div>
  )
}
