import { describe, expect, it } from 'vitest'
import { isKbRecordType } from './constants'
import { canStartDelete, filterKnowledgeRecords, parseKnowledgeTags } from './admin'
import type { KbRecord } from './types'

const records: KbRecord[] = [
  { id: '1', user_id: 'u', type: 'text', content: 'React hooks', tags: ['frontend'], created_at: '2026-01-01' },
  { id: '2', user_id: 'u', type: 'code', content: 'SQL query', tags: ['backend'], created_at: '2026-01-02' },
]

describe('knowledge admin helpers', () => {
  it('accepts only database-supported record types', () => {
    expect(isKbRecordType('text')).toBe(true)
    expect(isKbRecordType('code')).toBe(true)
    expect(isKbRecordType('article')).toBe(false)
    expect(isKbRecordType('')).toBe(false)
  })

  it('allows confirmation for the record currently awaiting deletion', () => {
    expect(canStartDelete('1', '1')).toBe(true)
    expect(canStartDelete('1', '2')).toBe(false)
    expect(canStartDelete(null, '2')).toBe(true)
  })

  it('normalizes and deduplicates tags', () => {
    expect(parseKnowledgeTags(' React, 前端，React ')).toEqual(['React', '前端'])
  })

  it('filters by keyword, type, and tag', () => {
    expect(filterKnowledgeRecords(records, { keyword: 'hooks', type: '', tag: '' })).toHaveLength(1)
    expect(filterKnowledgeRecords(records, { keyword: '', type: 'code', tag: 'backend' })).toEqual([records[1]])
    expect(filterKnowledgeRecords(records, { keyword: '', type: 'text', tag: 'backend' })).toHaveLength(0)
  })
})
