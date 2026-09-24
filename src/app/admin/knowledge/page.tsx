import { fetchKnowledgePageData } from '@/lib/knowledge/queries'
import { requireSuperAdmin } from '@/lib/auth/requireUser'
import { KnowledgeWorkbench } from '@/components/admin/KnowledgeWorkbench'

export default async function AdminKnowledgePage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null
  const { records, recordsError } = await fetchKnowledgePageData(user.id, { tagsFilter: [] })
  return recordsError ? <div className="sg-admin-page"><p className="sg-admin-state sg-admin-state--error">加载失败：{recordsError.message}</p></div> : <KnowledgeWorkbench initialRecords={records} />
}
