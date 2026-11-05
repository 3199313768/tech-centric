import { EmptyState, PageHeader, StatusMessage } from '@oxygen-design/patterns'
import { Card, CardContent } from '@oxygen-design/ui'
import { SkillAdminTable } from '@/components/admin/AdminDataTable'
import { fetchAiSkillsPageData } from '@/lib/skills/queries'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

export default async function AdminSkillsPage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null
  const { skills, error } = await fetchAiSkillsPageData()

  return (
    <div className="oxygen-admin-page">
      <PageHeader title="技能管理" description="查看当前收录的 AI 技能、平台和标签。" />
      {error ? (
        <StatusMessage title="技能暂时无法加载" tone="error">
          {error.message}
        </StatusMessage>
      ) : skills.length === 0 ? (
        <Card>
          <EmptyState title="暂无技能" description="技能入库后，这里会显示说明、平台和标签。" />
        </Card>
      ) : (
        <Card>
          <CardContent>
            <SkillAdminTable skills={skills} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
