import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('global spirit cursor scope', () => {
  it('mounts one cursor layer at the root instead of only on the home variant', () => {
    const rootLayout = readSource('src/app/layout.tsx')
    const atmosphereShell = readSource('src/components/spirit/shell/SpiritAtmosphereShell.tsx')

    expect(rootLayout).toContain('<SpiritCursorLayer />')
    expect(atmosphereShell).not.toContain('<SpiritCursorTrail />')
    expect(atmosphereShell).not.toContain('<SpiritCursor />')
  })

  it('hides the native pointer across the app while preserving text cursors', () => {
    const globalStyles = readSource('src/app/globals.css')

    expect(globalStyles).toContain('html.sg-spirit-cursor-active body *')
    expect(globalStyles).toContain('html.sg-spirit-cursor-active body input')
    expect(globalStyles).not.toContain('html.sg-spirit-cursor-active .spirit-garden-shell *')
  })
})
