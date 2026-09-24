import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const styles = readFileSync('src/app/globals.css', 'utf8')

describe('knowledge workbench modal layout', () => {
  it('uses half of the viewport for the admin knowledge dialog', () => {
    expect(styles).toContain('.sg-admin-page > .sg-modal-backdrop .sg-modal-panel { width: 50vw;')
  })

  it('does not duplicate the create action in the empty state', () => {
    const source = readFileSync('src/components/admin/KnowledgeWorkbench.tsx', 'utf8')
    expect(source).not.toContain("records.length === 0 ? '还没有知识记录。' : '没有符合条件的记录。'}</p><button")
  })

  it('uses the database-supported type options instead of free text', () => {
    const source = readFileSync('src/components/admin/KnowledgeWorkbench.tsx', 'utf8')
    expect(source).toContain('KB_RECORD_TYPES.map')
    expect(source).not.toContain('value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}')
  })

  it('vertically centers every admin knowledge table cell', () => {
    expect(styles).toContain('.sg-admin-table th, .sg-admin-table td { padding: 0.75rem 0.9rem; border-bottom: 1px solid color-mix(in srgb, var(--sg-ink) 9%, transparent); vertical-align: middle; }')
  })
})
