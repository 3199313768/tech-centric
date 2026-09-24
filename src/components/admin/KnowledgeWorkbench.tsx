'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createKbRecord, deleteKbRecord, updateKbRecord } from '@/lib/knowledge/actions'
import { canStartDelete, filterKnowledgeRecords, parseKnowledgeTags, type KnowledgeFilters } from '@/lib/knowledge/admin'
import { KB_RECORD_TYPES, isKbRecordType, type KbRecordType } from '@/lib/knowledge/constants'
import type { KbRecord } from '@/lib/knowledge/types'

interface KnowledgeWorkbenchProps {
  initialRecords: KbRecord[]
}

interface KnowledgeDraft {
  type: KbRecordType
  content: string
  tags: string
}

const DEFAULT_TYPE = 'text'

export function KnowledgeWorkbench({ initialRecords }: KnowledgeWorkbenchProps) {
  const [records, setRecords] = useState(initialRecords)
  const [filters, setFilters] = useState<KnowledgeFilters>({ keyword: '', type: '', tag: '' })
  const [draft, setDraft] = useState<KnowledgeDraft>({ type: DEFAULT_TYPE, content: '', tags: '' })
  const [editingRecord, setEditingRecord] = useState<KbRecord | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setIsCreating(false)
        setEditingRecord(null)
        setDeletingId(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const types = useMemo(() => Array.from(new Set([DEFAULT_TYPE, ...records.map((record) => record.type)])), [records])
  const tags = useMemo(() => Array.from(new Set(records.flatMap((record) => record.tags ?? []))).sort(), [records])
  const visibleRecords = useMemo(() => filterKnowledgeRecords(records, filters), [records, filters])
  const isDialogOpen = isCreating || editingRecord !== null

  const openCreate = () => {
    setEditingRecord(null)
    setDraft({ type: DEFAULT_TYPE, content: '', tags: '' })
    setError(null)
    setIsCreating(true)
  }

  const openEdit = (record: KbRecord) => {
    setIsCreating(false)
    setEditingRecord(record)
    setDraft({ type: isKbRecordType(record.type) ? record.type : DEFAULT_TYPE, content: record.content, tags: (record.tags ?? []).join(', ') })
    setError(null)
  }

  const closeDialog = () => {
    if (!isSaving) {
      setIsCreating(false)
      setEditingRecord(null)
      setError(null)
    }
  }

  const handleSave = async () => {
    if (isSaving || !draft.content.trim()) {
      if (!draft.content.trim()) setError('内容不能为空')
      return
    }
    setIsSaving(true)
    setError(null)
    const input = { type: draft.type, content: draft.content.trim(), tags: parseKnowledgeTags(draft.tags) }
    if (editingRecord) {
      const result = await updateKbRecord(editingRecord.id, input)
      if (!mountedRef.current) return
      if (result.error) {
        setError(result.error)
        setIsSaving(false)
        return
      }
      setRecords((current) => current.map((record) => record.id === editingRecord.id ? { ...record, ...input } : record))
    } else {
      const result = await createKbRecord(input)
      if (!mountedRef.current) return
      if (result.error) {
        setError(result.error)
        setIsSaving(false)
        return
      }
      if (result.record) setRecords((current) => [result.record as KbRecord, ...current])
    }
    setIsSaving(false)
    closeDialog()
  }

  const handleDelete = async (recordId: string) => {
    if (!canStartDelete(deletingId, recordId)) return
    setDeletingId(recordId)
    setError(null)
    const result = await deleteKbRecord(recordId)
    if (!mountedRef.current) return
    if (result.error) {
      setError(result.error)
    } else {
      setRecords((current) => current.filter((record) => record.id !== recordId))
    }
    setDeletingId(null)
  }

  return <div className="sg-admin-page">
    <div className="sg-admin-toolbar">
      <input ref={searchRef} className="sg-form-input" value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="搜索知识内容" aria-label="搜索知识内容" />
      <select className="sg-form-input" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} aria-label="按类型筛选"><option value="">全部类型</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <select className="sg-form-input" value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })} aria-label="按标签筛选"><option value="">全部标签</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
      <button type="button" className="sg-btn sg-btn--primary" onClick={openCreate}>新增知识</button>
    </div>
    {error && !isDialogOpen ? <p className="sg-admin-state sg-admin-state--error">{error}</p> : null}
    {visibleRecords.length === 0 ? <div className="sg-admin-state"><p>{records.length === 0 ? '还没有知识记录。' : '没有符合条件的记录。'}</p></div> : <div className="sg-admin-table-wrap"><table className="sg-admin-table"><thead><tr><th>类型</th><th>内容</th><th>标签</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><td>{record.type}</td><td>{record.content}</td><td>{record.tags?.join('、') || '-'}</td><td>{new Date(record.created_at).toLocaleDateString('zh-CN')}</td><td><button type="button" className="sg-btn sg-admin-action" onClick={() => openEdit(record)}>编辑</button>{deletingId === record.id ? <span className="sg-admin-delete-confirm"><button type="button" className="sg-btn sg-admin-action sg-admin-action--danger" onClick={() => handleDelete(record.id)}>确认删除</button><button type="button" className="sg-btn sg-admin-action" onClick={() => setDeletingId(null)}>取消</button></span> : <button type="button" className="sg-btn sg-admin-action" onClick={() => setDeletingId(record.id)}>删除</button>}</td></tr>)}</tbody></table></div>}
    {isDialogOpen ? <div className="sg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}><div className="sg-modal-panel" role="dialog" aria-modal="true" aria-labelledby="knowledge-dialog-title"><h2 id="knowledge-dialog-title">{editingRecord ? '编辑知识' : '新增知识'}</h2><label className="sg-form-field"><span>类型</span><select className="sg-form-input" value={draft.type} onChange={(event) => { if (isKbRecordType(event.target.value)) setDraft({ ...draft, type: event.target.value }) }} aria-label="知识类型">{KB_RECORD_TYPES.map((recordType) => <option key={recordType.id} value={recordType.id}>{recordType.label}</option>)}</select></label><label className="sg-form-field"><span>内容</span><textarea className="sg-form-textarea" rows={6} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></label><label className="sg-form-field"><span>标签</span><input className="sg-form-input" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="多个标签用逗号分隔" /></label>{error ? <p className="sg-kb-error sg-kb-error--inline">{error}</p> : null}<div className="sg-modal-actions"><button type="button" className="sg-btn sg-btn--ghost" onClick={closeDialog} disabled={isSaving}>取消</button><button type="button" className="sg-btn sg-btn--primary" onClick={handleSave} disabled={isSaving}>{isSaving ? '保存中' : '保存'}</button></div></div></div> : null}
  </div>
}
