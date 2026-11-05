import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/components/admin/AdminDataTable.tsx', 'utf8')
const resourcePage = readFileSync('src/app/admin/resources/page.tsx', 'utf8')
const skillPage = readFileSync('src/app/admin/skills/page.tsx', 'utf8')

describe('admin data tables', () => {
  it('uses the Oxygen table and renders the existing resource and skill fields', () => {
    expect(source).toContain("from '@oxygen-design/ui'")
    expect(source).toContain('<Table')
    for (const label of ['名称', '分类', '链接', '点击', '技能', '说明', '平台', '标签']) {
      expect(source).toContain(label)
    }
  })

  it('uses Oxygen page, card, and empty-state structures', () => {
    for (const pageSource of [resourcePage, skillPage]) {
      for (const component of ['Card', 'EmptyState', 'PageHeader', 'StatusMessage']) {
        expect(pageSource).toContain(component)
      }
    }
  })
})
