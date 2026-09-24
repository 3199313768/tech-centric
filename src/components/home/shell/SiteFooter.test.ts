import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/components/home/shell/SiteFooter.tsx', 'utf8')
const shellSource = readFileSync('src/components/spirit/shell/SpiritAtmosphereShell.tsx', 'utf8')
const styles = readFileSync('src/app/globals.css', 'utf8')

describe('site footer contact links', () => {
  it('does not render the email contact entry', () => {
    expect(source).not.toContain('sg-footer-email')
    expect(source).not.toContain('mailto:${email}')
  })

  it('does not render a site footer from the shared atmosphere shell', () => {
    expect(shellSource).not.toContain("import { SiteFooter } from '@/components/home/shell/SiteFooter'")
    expect(shellSource).not.toContain('<SiteFooter')
  })

  it('keeps the footer at the viewport bottom when page content is short', () => {
    expect(styles).toContain('.spirit-garden-shell {\n  position: relative;\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;')
    expect(styles).toContain('.spirit-garden-shell > .sg-hero-stage,\n.spirit-garden-shell > .spirit-garden-content {\n  flex: 1 0 auto;')
  })
})
