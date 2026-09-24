import type { KbRecord } from '@/lib/knowledge/types'

export interface KnowledgeFilters {
  keyword: string
  type: string
  tag: string
}

export function canStartDelete(deletingId: string | null, recordId: string): boolean {
  return deletingId === null || deletingId === recordId
}

export function parseKnowledgeTags(value: string): string[] {
  return Array.from(new Set(value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)))
}

export function filterKnowledgeRecords(records: KbRecord[], filters: KnowledgeFilters): KbRecord[] {
  const keyword = filters.keyword.trim().toLocaleLowerCase()
  return records.filter((record) => {
    const matchesKeyword = !keyword || `${record.type} ${record.content}`.toLocaleLowerCase().includes(keyword)
    const matchesType = !filters.type || record.type === filters.type
    const matchesTag = !filters.tag || record.tags?.includes(filters.tag)
    return matchesKeyword && matchesType && matchesTag
  })
}
