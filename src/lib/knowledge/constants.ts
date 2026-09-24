export const KB_RECORDS_PAGE_SIZE = 50
export const KB_TAGS_PAGE_SIZE = 500
export const KB_MAX_FILE_SIZE = 5 * 1024 * 1024
export const KB_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7

export const KB_RECORD_TYPES = [
  { id: 'text', label: '笔记' },
  { id: 'code', label: '代码' },
  { id: 'image', label: '图片' },
  { id: 'file', label: '附件' },
] as const

export type KbRecordType = (typeof KB_RECORD_TYPES)[number]['id']

export function isKbRecordType(value: string): value is KbRecordType {
  return KB_RECORD_TYPES.some((recordType) => recordType.id === value)
}
