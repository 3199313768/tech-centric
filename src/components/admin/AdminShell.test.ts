import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/admin/AdminShell.tsx', 'utf8')
const styles = readFileSync('src/app/globals.css', 'utf8')

describe('admin shell navigation', () => {
  it('keeps six navigation entries and removes the decorative status note', () => {
    expect(source).toContain("href: '/admin'")
    expect(source).toContain("href: '/admin/knowledge'")
    expect(source).toContain("href: '/admin/resources'")
    expect(source).toContain("href: '/admin/skills'")
    expect(source).toContain("href: '/admin/workflows'")
    expect(source).toContain("href: '/admin/settings'")
    expect(source).toContain('admin_nav_order')
    expect(source).toContain('updateUser')
    expect(source).toContain('onDrop')
    expect(source).not.toContain('今日庭院状态')
  })

  it('keeps the admin area in a light theme even when the site is dark', () => {
    expect(styles).toContain('.sg-admin {')
    expect(styles).toContain('color-scheme: light;')
    expect(styles).toContain('.dark .sg-admin {')
    expect(styles).toContain('--sg-cream: var(--sg-admin-white);')
    expect(styles).toContain('--sg-ink-strong: var(--sg-admin-black);')
  })

  it('defines a professional neutral surface and blue admin accent', () => {
    expect(styles).toContain('--sg-admin-accent:')
    expect(styles).toContain('--sg-admin-surface:')
    expect(styles).toContain('background: var(--sg-admin-accent);')
    expect(styles).toContain('.dark .sg-admin-denied')
  })

  it('uses normal browser cursors throughout admin interactions', () => {
    expect(styles).toContain('body:has(.sg-admin) .sg-spirit-cursor')
    expect(styles).toContain('html.sg-spirit-cursor-active body .sg-admin *')
    expect(styles).toContain('cursor: default !important;')
  })
})
