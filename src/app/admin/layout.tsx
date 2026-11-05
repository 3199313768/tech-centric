import '@oxygen-design/ui/styles.css'
import '@oxygen-design/patterns/styles.css'
import { redirect } from 'next/navigation'
import { StatusMessage } from '@oxygen-design/patterns'
import { ConfigProvider } from '@oxygen-design/ui'
import { AdminShell } from '@/components/admin/AdminShell'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, error } = await requireSuperAdmin()
  if (!user && error) redirect('/login?next=/admin')
  if (error) {
    return (
      <ConfigProvider theme="light">
        <main className="oxygen-admin-denied">
          <StatusMessage title="暂时无法进入管理工作台" tone="error">
            {error}
          </StatusMessage>
        </main>
      </ConfigProvider>
    )
  }
  if (!user) redirect('/login?next=/admin')
  const initialNavOrder = Array.isArray(user.user_metadata?.admin_nav_order)
    ? user.user_metadata.admin_nav_order.filter((value): value is string => typeof value === 'string')
    : undefined
  return <AdminShell initialNavOrder={initialNavOrder}>{children}</AdminShell>
}
