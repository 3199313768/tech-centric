import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, error } = await requireSuperAdmin()
  if (!user && error) redirect('/login?next=/admin')
  if (error) {
    return (
      <div className="sg-admin-denied" role="alert">
        <h1>暂时无法进入管理工作台</h1>
        <p>{error}</p>
      </div>
    )
  }
  if (!user) redirect('/login?next=/admin')
  const initialNavOrder = Array.isArray(user.user_metadata?.admin_nav_order)
    ? user.user_metadata.admin_nav_order.filter((value): value is string => typeof value === 'string')
    : undefined
  return <AdminShell initialNavOrder={initialNavOrder}>{children}</AdminShell>
}
