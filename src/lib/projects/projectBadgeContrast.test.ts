import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readStyles() {
  return readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
}

describe('project visibility badge contrast', () => {
  it('uses dark text for the public badge in dark theme', () => {
    const styles = readStyles()

    expect(styles).toContain('.dark .sg-project-card__badge--public {\n  color: var(--sg-cream);\n}')
  })
})
