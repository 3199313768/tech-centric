import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/app/admin/page.tsx', 'utf8')

describe('admin dashboard hierarchy', () => {
  it('uses Oxygen surfaces while preserving the current dashboard content', () => {
    for (const component of ['Card', 'EmptyState', 'PageHeader', 'Statistic', 'StatusMessage']) {
      expect(source).toContain(component)
    }
    expect(source).not.toContain('从收集到沉淀')
    expect(source).not.toContain('WORKFLOW')
    expect(source).not.toContain('SPIRITGARDEN ADMIN')
    expect(source).not.toContain('RECENT NOTES')
    expect(source).toContain('最近加入的知识')
    expect(source).toContain('资产概览')
  })

  it('uses a named Typography export across the server client boundary', () => {
    expect(source).toContain('TypographyText')
    expect(source).not.toContain('Typography.Text')
  })
})
