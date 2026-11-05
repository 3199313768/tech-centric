import { EmptyState, PageHeader, StatusMessage } from '@oxygen-design/patterns'
import { Card, CardContent } from '@oxygen-design/ui'
import { ResourceAdminTable } from '@/components/admin/AdminDataTable'
import { fetchResourcesPageData } from '@/lib/resources/queries'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

export default async function AdminResourcesPage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null
  const { items, error } = await fetchResourcesPageData()

  return (
    <div className="oxygen-admin-page">
      <PageHeader title="资源管理" description="查看站内收录的资源链接和使用情况。" />
      {error ? (
        <StatusMessage title="资源暂时无法加载" tone="error">
          {error.message}
        </StatusMessage>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="暂无资源" description="资源入库后，这里会显示链接、分类和点击数据。" />
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ResourceAdminTable items={items} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
