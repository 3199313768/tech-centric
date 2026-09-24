import Link from 'next/link'
import { ArrowUpRight, BookOpen, Boxes, Sparkles } from 'lucide-react'
import { fetchKnowledgePageData } from '@/lib/knowledge/queries'
import { fetchResourcesPageData } from '@/lib/resources/queries'
import { fetchAiSkillsPageData } from '@/lib/skills/queries'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

const EMPTY_KNOWLEDGE_PARAMS = { tagsFilter: [] as string[] }

export default async function AdminDashboardPage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null

  const [{ records, recordsError }, resources, skills] = await Promise.all([
    fetchKnowledgePageData(user.id, EMPTY_KNOWLEDGE_PARAMS),
    fetchResourcesPageData(),
    fetchAiSkillsPageData(),
  ])
  const recentRecords = records.slice(0, 5)

  return (
    <div className="sg-admin-page">
      <header className="sg-admin-header">
        <div>
          <h1>庭院总览</h1>
          <p>把新知识、工具和技能整理成可持续生长的资产。</p>
        </div>
        <Link className="sg-btn sg-btn--primary" href="/">
          返回前台 <ArrowUpRight aria-hidden size={16} />
        </Link>
      </header>

      <section className="sg-admin-stat-grid" aria-label="资产概览">
        <StatCard href="/admin/knowledge" label="知识记录" value={recordsError ? '-' : records.length} icon={<BookOpen />} />
        <StatCard href="/admin/resources" label="资源链接" value={resources.error ? '-' : resources.items.length} icon={<Boxes />} />
        <StatCard href="/admin/skills" label="技能条目" value={skills.error ? '-' : skills.skills.length} icon={<Sparkles />} />
      </section>

      <section className="sg-admin-content-grid">
        <div className="sg-admin-panel">
          <div className="sg-admin-panel__heading">
            <div>
              <h2>最近加入的知识</h2>
            </div>
            <Link href="/admin/knowledge">查看全部</Link>
          </div>
          {recordsError ? (
            <p className="sg-admin-state sg-admin-state--error">知识库暂时无法加载。</p>
          ) : recentRecords.length === 0 ? (
            <p className="sg-admin-state">还没有知识记录。</p>
          ) : (
            <ul className="sg-admin-record-list">
              {recentRecords.map((record) => (
                <li key={record.id}>
                  <span className="sg-admin-record-list__type">{record.type}</span>
                  <span>{record.content.slice(0, 100)}</span>
                  <time dateTime={record.created_at}>{new Date(record.created_at).toLocaleDateString('zh-CN')}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({ href, label, value, icon }: { href: string; label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Link className="sg-admin-stat" href={href}>
      <span className="sg-admin-stat__icon" aria-hidden>{icon}</span>
      <span className="sg-admin-stat__label">{label}</span>
      <strong>{value}</strong>
      <ArrowUpRight className="sg-admin-stat__arrow" aria-hidden size={16} />
    </Link>
  )
}
