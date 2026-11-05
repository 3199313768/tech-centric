import { EmptyState, PageHeader } from '@oxygen-design/patterns'
import { Card } from '@oxygen-design/ui'

export default function AdminSettingsPage() {
  return (
    <div className="oxygen-admin-page">
      <PageHeader title="系统设置" description="管理后台系统选项。" />
      <Card>
        <EmptyState title="暂无系统选项" description="当前暂无需要配置的系统选项。" />
      </Card>
    </div>
  )
}
