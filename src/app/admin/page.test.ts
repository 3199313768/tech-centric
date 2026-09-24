import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/admin/page.tsx', 'utf8')

describe('admin dashboard hierarchy', () => {
  it('does not render promotional workflow content or English eyebrow labels', () => {
    expect(source).not.toContain('从收集到沉淀')
    expect(source).not.toContain('WORKFLOW')
    expect(source).not.toContain('SPIRITGARDEN ADMIN')
    expect(source).not.toContain('RECENT NOTES')
    expect(source).toContain('最近加入的知识')
    expect(source).toContain('资产概览')
  })
})
