'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { X } from 'lucide-react'
import { ChatPanel } from '@/components/rag/chat/ChatPanel'
import { clampTriggerPosition, type TriggerPosition } from '@/lib/rag/triggerPosition'

const TRIGGER_POSITION_STORAGE_KEY = 'spirit-garden-rag-trigger-position'

interface DragState {
  pointerId: number
  offsetX: number
  offsetY: number
  moved: boolean
}

function readStoredTriggerPosition(): TriggerPosition | null {
  if (typeof window === 'undefined') return null

  const stored = window.localStorage.getItem(TRIGGER_POSITION_STORAGE_KEY)
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored) as Partial<TriggerPosition>
    if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
      return { left: parsed.left as number, top: parsed.top as number }
    }
  } catch {
    window.localStorage.removeItem(TRIGGER_POSITION_STORAGE_KEY)
  }

  return null
}

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [triggerPosition, setTriggerPosition] = useState<TriggerPosition | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTriggerPosition(readStoredTriggerPosition())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!triggerPosition) return
    window.localStorage.setItem(TRIGGER_POSITION_STORAGE_KEY, JSON.stringify(triggerPosition))
  }, [triggerPosition])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const rect = event.currentTarget.getBoundingClientRect()
    if (!drag.moved && Math.hypot(event.clientX - (rect.left + drag.offsetX), event.clientY - (rect.top + drag.offsetY)) < 5) {
      return
    }

    drag.moved = true
    event.preventDefault()
    const nextPosition = clampTriggerPosition({
      left: event.clientX - drag.offsetX,
      top: event.clientY - drag.offsetY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      triggerWidth: rect.width,
      triggerHeight: rect.height,
    })
    setTriggerPosition(nextPosition)
  }

  const finishPointerInteraction = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    suppressClickRef.current = drag.moved
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setIsOpen((value) => !value)
  }

  const triggerStyle = triggerPosition
    ? {
        position: 'fixed' as const,
        left: triggerPosition.left,
        top: triggerPosition.top,
        right: 'auto',
        bottom: 'auto',
      }
    : undefined

  return (
    <div className={`sg-rag-shell${isOpen ? ' sg-rag-shell--open' : ''}`}>
      {isOpen ? (
        <div className="sg-rag-panel-wrap">
          <ChatPanel />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        style={triggerStyle}
        className={`sg-rag-trigger sg-rag-trigger--icon-only sg-rag-trigger--sprite${triggerPosition ? ' sg-rag-trigger--dragged' : ''}`}
        aria-expanded={isOpen}
        aria-label={isOpen ? '关闭庭院导引' : '打开庭院导引'}
      >
        <span className="sg-rag-trigger__icon">
          {isOpen ? (
            <X className="sg-rag-trigger__icon-svg" aria-hidden />
          ) : (
            <Image
              src="/spirit-garden/个人信使角色-透明底.png"
              alt=""
              width={36}
              height={36}
              className="sg-rag-trigger__sprite-img"
              aria-hidden
            />
          )}
        </span>
      </button>
    </div>
  )
}
