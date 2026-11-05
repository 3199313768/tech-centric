import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/components/admin/KnowledgeWorkbench.tsx', 'utf8')
const pageSource = readFileSync('src/app/admin/knowledge/page.tsx', 'utf8')

describe('knowledge workbench Oxygen controls', () => {
  it('uses Oxygen dialogs, form controls, states, and table', () => {
    expect(source).toContain("from '@oxygen-design/patterns'")
    expect(source).toContain("from '@oxygen-design/ui'")
    for (const component of [
      'AlertDialog',
      'Button',
      'Dialog',
      'EmptyState',
      'Field',
      'Input',
      'PageHeader',
      'Select',
      'StatusMessage',
      'Table',
      'Textarea',
    ]) {
      expect(source).toContain(component)
    }
  })

  it('preserves database-backed record types and removes raw admin controls', () => {
    expect(source).toContain('KB_RECORD_TYPES.map')
    expect(source).not.toContain('sg-modal-backdrop')
    expect(source).not.toContain('sg-admin-table')
    expect(source).not.toContain('<select')
    expect(source).not.toContain('<table')
  })

  it('uses Oxygen status presentation when knowledge loading fails', () => {
    expect(pageSource).toContain('StatusMessage')
    expect(pageSource).not.toContain('sg-admin-state')
  })
})
