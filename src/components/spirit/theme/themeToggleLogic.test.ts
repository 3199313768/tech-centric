import { describe, expect, it } from 'vitest'
import { getNextTheme, shouldAnimateThemeChange } from './themeToggleLogic'

describe('theme toggle logic', () => {
  it('toggles from the resolved theme, including system-theme fallbacks', () => {
    expect(getNextTheme('light')).toBe('dark')
    expect(getNextTheme('dark')).toBe('light')
    expect(getNextTheme(undefined)).toBe('dark')
  })

  it('only enables the global transition when motion is allowed', () => {
    expect(shouldAnimateThemeChange(false)).toBe(true)
    expect(shouldAnimateThemeChange(true)).toBe(false)
  })
})
