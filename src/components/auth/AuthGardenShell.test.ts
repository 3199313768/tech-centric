import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const shellSource = readFileSync('src/components/auth/AuthGardenShell.tsx', 'utf8')
const styles = readFileSync('src/app/globals.css', 'utf8')
const authPagePaths = [
  'src/app/login/page.tsx',
  'src/app/forgot-password/page.tsx',
  'src/app/reset-password/page.tsx',
]

describe('AuthGardenShell', () => {
  it('exposes a collapsible accessible panel', () => {
    expect(shellSource).toContain('aria-expanded')
    expect(shellSource).toContain('aria-controls="auth-garden-panel"')
    expect(shellSource).toContain('showStoryNodes={false}')
  })

  it('keeps the form outside the scene gesture surface', () => {
    expect(shellSource).toContain('sg-auth-garden__panel')
    expect(shellSource).toContain('sg-auth-garden__canvas-tools')
  })

  it('uses the shell for every password authentication route', () => {
    for (const pagePath of authPagePaths) {
      const source = readFileSync(pagePath, 'utf8')
      expect(source).toContain("@/components/auth/AuthGardenShell")
      expect(source).toContain('<AuthGardenShell>')
      expect(source).toContain('<Suspense')
    }
  })

  it('defines the responsive and reduced-motion shell styles', () => {
    expect(styles).toContain('.sg-auth-garden')
    expect(styles).toContain('.sg-auth-garden--exploring')
    expect(styles).toContain('@media (max-width: 767px)')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
