'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState, PageHeader, StatusMessage } from '@oxygen-design/patterns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldControl,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  Tag,
  Textarea,
  type TableColumn,
} from '@oxygen-design/ui'
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
  const [isDeleting, setIsDeleting] = useState(false)
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
      if (event.key === 'Escape' && !isSaving && !isDeleting) {
        setIsCreating(false)
        setEditingRecord(null)
        setDeletingId(null)
        setError(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, isSaving])

  const types = useMemo(() => Array.from(new Set([DEFAULT_TYPE, ...records.map((record) => record.type)])), [records])
  const tags = useMemo(() => Array.from(new Set(records.flatMap((record) => record.tags ?? []))).sort(), [records])
  const visibleRecords = useMemo(() => filterKnowledgeRecords(records, filters), [records, filters])
  const deletingRecord = deletingId ? records.find((record) => record.id === deletingId) ?? null : null
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
    setIsCreating(false)
    setEditingRecord(null)
  }

  const handleDelete = async (recordId: string) => {
    if (isDeleting || !canStartDelete(deletingId, recordId)) return
    setIsDeleting(true)
    setError(null)
    const result = await deleteKbRecord(recordId)
    if (!mountedRef.current) return
    if (result.error) {
      setError(result.error)
    } else {
      setRecords((current) => current.filter((record) => record.id !== recordId))
    }
    setIsDeleting(false)
    setDeletingId(null)
  }

  const columns: TableColumn<KbRecord>[] = [
    {
      key: 'type',
      dataIndex: 'type',
      title: '类型',
      render: (value) => <Badge variant="secondary">{String(value)}</Badge>,
    },
    { key: 'content', dataIndex: 'content', title: '内容', ellipsis: true },
    {
      key: 'tags',
      dataIndex: 'tags',
      title: '标签',
      render: (_, record) => record.tags?.length ? (
        <span className="oxygen-admin-tag-list">
          {record.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </span>
      ) : '-',
    },
    {
      key: 'created_at',
      dataIndex: 'created_at',
      title: '创建时间',
      render: (value) => new Date(String(value)).toLocaleDateString('zh-CN'),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_, record) => (
        <div className="oxygen-admin-row-actions">
          <Button type="button" variant="link" size="sm" onClick={() => openEdit(record)}>编辑</Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="oxygen-admin-action--danger"
            onClick={() => {
              setError(null)
              setDeletingId(record.id)
            }}
          >
            删除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="oxygen-admin-page">
      <PageHeader
        title="知识库"
        description="筛选、整理和维护站内知识记录。"
        actions={<Button onClick={openCreate}>新增知识</Button>}
      />

      <Card>
        <CardContent>
          <div className="oxygen-admin-toolbar">
            <Field className="oxygen-admin-toolbar__search">
              <FieldLabel>搜索知识内容</FieldLabel>
              <FieldControl>
                <Input
                  ref={searchRef}
                  value={filters.keyword}
                  onChange={(event) => setFilters({ ...filters, keyword: event.target.value })}
                  placeholder="输入关键词"
                />
              </FieldControl>
            </Field>

            <Field>
              <FieldLabel>类型</FieldLabel>
              <Select
                value={filters.type || 'all'}
                onValueChange={(value) => setFilters({ ...filters, type: value === 'all' ? '' : value })}
              >
                <SelectTrigger aria-label="按类型筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {types.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>标签</FieldLabel>
              <Select
                value={filters.tag || 'all'}
                onValueChange={(value) => setFilters({ ...filters, tag: value === 'all' ? '' : value })}
              >
                <SelectTrigger aria-label="按标签筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部标签</SelectItem>
                  {tags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {error && !isDialogOpen && deletingId === null ? (
        <StatusMessage title="操作失败" tone="error">{error}</StatusMessage>
      ) : null}

      {visibleRecords.length === 0 ? (
        <Card>
          <EmptyState
            title={records.length === 0 ? '还没有知识记录' : '没有符合条件的记录'}
            description={records.length === 0 ? '使用“新增知识”创建第一条记录。' : '调整搜索关键词或筛选项后再试。'}
          />
        </Card>
      ) : (
        <Table
          columns={columns}
          dataSource={visibleRecords}
          rowKey="id"
          emptyText={records.length === 0 ? '还没有知识记录。' : '没有符合条件的记录。'}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? '编辑知识' : '新增知识'}</DialogTitle>
            <DialogDescription>填写知识类型、内容和标签；内容为必填项。</DialogDescription>
          </DialogHeader>

          <div className="oxygen-admin-form">
            <Field required>
              <FieldLabel>类型</FieldLabel>
              <Select
                value={draft.type}
                onValueChange={(value) => {
                  if (isKbRecordType(value)) setDraft({ ...draft, type: value })
                }}
              >
                <SelectTrigger aria-label="知识类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_RECORD_TYPES.map((recordType) => (
                    <SelectItem key={recordType.id} value={recordType.id}>{recordType.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field required invalid={Boolean(error)}>
              <FieldLabel>内容</FieldLabel>
              <FieldControl>
                <Textarea
                  rows={6}
                  value={draft.content}
                  onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                />
              </FieldControl>
              <FieldError>{error}</FieldError>
            </Field>

            <Field>
              <FieldLabel>标签</FieldLabel>
              <FieldControl>
                <Input
                  value={draft.tags}
                  onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
                  placeholder="多个标签用逗号分隔"
                />
              </FieldControl>
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={closeDialog} disabled={isSaving}>取消</Button>
            <Button type="button" onClick={handleSave} loading={isSaving}>
              {isSaving ? '保存中' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => { if (!open && !isDeleting) setDeletingId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除知识？</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRecord ? `“${deletingRecord.content.slice(0, 60)}”删除后无法恢复。` : '删除后无法恢复。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                if (deletingId) void handleDelete(deletingId)
              }}
            >
              {isDeleting ? '删除中' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
