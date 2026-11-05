import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/components/admin/AdminShell.tsx', 'utf8')
const layoutSource = readFileSync('src/app/admin/layout.tsx', 'utf8')
const styles = readFileSync('src/app/globals.css', 'utf8')

describe('admin shell navigation', () => {
  it('uses Oxygen shell and controls while preserving navigation behavior', () => {
    for (const item of [
      "href: '/admin'",
      "href: '/admin/knowledge'",
      "href: '/admin/resources'",
      "href: '/admin/skills'",
      "href: '/admin/workflows'",
      "href: '/admin/settings'",
    ]) {
      expect(source).toContain(item)
    }

    expect(source).toContain("from '@oxygen-design/patterns'")
    expect(source).toContain("from '@oxygen-design/ui'")
    expect(source).toContain('<AppShell')
    expect(source).toContain('<ConfigProvider')
    expect(source).toContain('<Button')
    expect(source).toContain('mobileNavigation')
    expect(source).toContain('admin_nav_order')
    expect(source).toContain('updateUser')
    expect(source).toContain('onDrop')
  })

  it('loads Oxygen styles and defines an admin layout adapter', () => {
    expect(layoutSource).toContain('@oxygen-design/ui/styles.css')
    expect(layoutSource).toContain('@oxygen-design/patterns/styles.css')
    expect(layoutSource).toContain('StatusMessage')
    expect(layoutSource).not.toContain('sg-admin-denied')
    expect(styles).toContain('.oxygen-admin-shell')
    expect(styles).toContain('.oxygen-admin-shell {\n  display: grid;\n}')
    expect(styles).toContain('.oxygen-admin-nav')
    expect(styles).toContain('.oxygen-admin-page')
  })
})
