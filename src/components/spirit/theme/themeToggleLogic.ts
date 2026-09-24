export type ResolvedTheme = 'light' | 'dark' | undefined
export const THEME_TRANSITION_DURATION_MS = 260

export function getNextTheme(currentTheme: ResolvedTheme): 'light' | 'dark' {
  return currentTheme === 'dark' ? 'light' : 'dark'
}

export function shouldAnimateThemeChange(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion
}
