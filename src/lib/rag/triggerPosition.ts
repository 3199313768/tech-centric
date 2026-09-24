export interface TriggerPosition {
  left: number
  top: number
}

interface ClampTriggerPositionInput extends TriggerPosition {
  viewportWidth: number
  viewportHeight: number
  triggerWidth: number
  triggerHeight: number
  margin?: number
}

export function clampTriggerPosition({
  left,
  top,
  viewportWidth,
  viewportHeight,
  triggerWidth,
  triggerHeight,
  margin = 16,
}: ClampTriggerPositionInput): TriggerPosition {
  const maxLeft = Math.max(margin, viewportWidth - triggerWidth - margin)
  const maxTop = Math.max(margin, viewportHeight - triggerHeight - margin)

  return {
    left: Math.min(Math.max(left, margin), maxLeft),
    top: Math.min(Math.max(top, margin), maxTop),
  }
}
