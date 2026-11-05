import Link from 'next/link'
import { ArrowUpRight, BookOpen, Boxes, Sparkles } from 'lucide-react'
import { EmptyState, PageHeader, StatusMessage } from '@oxygen-design/patterns'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Statistic,
  TypographyText,
} from '@oxygen-design/ui'
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
    <div className="oxygen-admin-page">
      <PageHeader
        title="庭院总览"
        description="把新知识、工具和技能整理成可持续生长的资产。"
        actions={
          <Button asChild>
            <Link href="/">
              返回前台 <ArrowUpRight aria-hidden size={16} />
            </Link>
          </Button>
        }
      />

      <section className="oxygen-admin-stat-grid" aria-label="资产概览">
        <StatCard href="/admin/knowledge" label="知识记录" value={recordsError ? '-' : records.length} icon={<BookOpen />} />
        <StatCard href="/admin/resources" label="资源链接" value={resources.error ? '-' : resources.items.length} icon={<Boxes />} />
        <StatCard href="/admin/skills" label="技能条目" value={skills.error ? '-' : skills.skills.length} icon={<Sparkles />} />
      </section>

      <Card>
        <CardHeader className="oxygen-admin-card-heading">
          <CardTitle>最近加入的知识</CardTitle>
          <Button asChild variant="link" size="sm">
            <Link href="/admin/knowledge">查看全部</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recordsError ? (
            <StatusMessage title="知识库暂时无法加载" tone="error">
              请稍后刷新页面重试。
            </StatusMessage>
          ) : recentRecords.length === 0 ? (
            <EmptyState title="还没有知识记录" description="新增一条知识后，这里会显示最近加入的内容。" />
          ) : (
            <ul className="oxygen-admin-record-list">
              {recentRecords.map((record) => (
                <li key={record.id}>
                  <Badge variant="secondary">{record.type}</Badge>
                  <TypographyText>{record.content.slice(0, 100)}</TypographyText>
                  <time dateTime={record.created_at}>{new Date(record.created_at).toLocaleDateString('zh-CN')}</time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ href, label, value, icon }: { href: string; label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Link className="oxygen-admin-stat-link" href={href}>
      <Card className="oxygen-admin-stat-card">
        <CardContent>
          <span className="oxygen-admin-stat-card__icon" aria-hidden>{icon}</span>
          <Statistic title={label} value={value} />
          <ArrowUpRight className="oxygen-admin-stat-card__arrow" aria-hidden size={16} />
        </CardContent>
      </Card>
    </Link>
  )
}
