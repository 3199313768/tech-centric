import { describe, expect, it } from 'vitest'
import { clampTriggerPosition } from './triggerPosition'

describe('clampTriggerPosition', () => {
  it('keeps the dragged trigger inside the viewport margins', () => {
    expect(
      clampTriggerPosition({
        left: -20,
        top: 900,
        viewportWidth: 1000,
        viewportHeight: 800,
        triggerWidth: 52,
        triggerHeight: 52,
      }),
    ).toEqual({ left: 16, top: 732 })
  })

  it('handles a trigger larger than the available viewport', () => {
    expect(
      clampTriggerPosition({
        left: 80,
        top: 80,
        viewportWidth: 100,
        viewportHeight: 100,
        triggerWidth: 120,
        triggerHeight: 120,
      }),
    ).toEqual({ left: 16, top: 16 })
  })
})
