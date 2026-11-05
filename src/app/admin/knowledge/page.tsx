import { PageHeader, StatusMessage } from '@oxygen-design/patterns'
import { fetchKnowledgePageData } from '@/lib/knowledge/queries'
import { requireSuperAdmin } from '@/lib/auth/requireUser'
import { KnowledgeWorkbench } from '@/components/admin/KnowledgeWorkbench'

export default async function AdminKnowledgePage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null
  const { records, recordsError } = await fetchKnowledgePageData(user.id, { tagsFilter: [] })
  return recordsError ? (
    <div className="oxygen-admin-page">
      <PageHeader title="知识库" description="筛选、整理和维护站内知识记录。" />
      <StatusMessage title="知识记录加载失败" tone="error">{recordsError.message}</StatusMessage>
    </div>
  ) : (
    <KnowledgeWorkbench initialRecords={records} />
  )
}
