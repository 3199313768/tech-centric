import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readStyles() {
  return readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
}

describe('mobile navigation drawer', () => {
  it('uses readable dark-theme colors for links and account text', () => {
    const styles = readStyles()

    expect(styles).toContain('.dark .sg-nav-drawer-link {\n  color: var(--sg-ink-strong);\n}')
    expect(styles).toContain('.dark .sg-nav-user__email {\n  color: rgba(232, 245, 228, 0.72);\n}')
    expect(styles).not.toContain('.dark .sg-nav-drawer-link {\n  color: var(--sg-cream);\n}')
  })

  it('keeps drawer items compact while preserving the touch target', () => {
    const styles = readStyles()

    expect(styles).toContain('.sg-nav-drawer-links {\n  min-height: 100%;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}')
    expect(styles).toContain('  box-sizing: border-box;\n  min-height: var(--sg-touch-min);\n  padding: 10px 14px;')
  })

  it('keeps primary and secondary links on the same vertical rhythm', () => {
    const styles = readStyles()

    expect(styles).toContain('.sg-nav-drawer-divider {\n  display: none;\n}')
  })

  it('anchors the account controls to the bottom of the drawer', () => {
    const styles = readStyles()

    expect(styles).toContain('  min-height: 100%;\n  display: flex;\n  flex-direction: column;')
    expect(styles).toContain('.sg-nav-drawer-user {\n  margin-top: auto;')
  })

  it('starts drawer navigation close to the top edge', () => {
    const styles = readStyles()

    expect(styles).toContain('padding: calc(20px + env(safe-area-inset-top, 0px)) 20px')
    expect(styles).toContain('padding-top: calc(16px + env(safe-area-inset-top, 0px));')
  })

  it('presents account actions as a compact drawer card', () => {
    const styles = readStyles()

    expect(styles).toContain('.sg-nav-drawer .sg-nav-user {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;')
    expect(styles).toContain('  padding: 12px;\n  border: 1px solid var(--sg-border);\n  border-radius: 14px;')
    expect(styles).toContain('.sg-nav-drawer .sg-nav-user__email {\n  max-width: none;\n  min-width: 0;')
  })
})
