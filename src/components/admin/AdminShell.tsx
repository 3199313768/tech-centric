'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, type DragEventHandler } from 'react'
import { AppShell, StatusMessage } from '@oxygen-design/patterns'
import { Button, ConfigProvider, Typography } from '@oxygen-design/ui'
import { BookOpen, Boxes, LayoutDashboard, Settings, Sparkles, Workflow } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ADMIN_NAV_ITEMS = [
  { href: '/admin', label: '仪表盘', icon: LayoutDashboard },
  { href: '/admin/knowledge', label: '知识库', icon: BookOpen },
  { href: '/admin/resources', label: '资源管理', icon: Boxes },
  { href: '/admin/skills', label: '技能管理', icon: Sparkles },
  { href: '/admin/workflows', label: '流程工作台', icon: Workflow },
  { href: '/admin/settings', label: '系统设置', icon: Settings },
] as const

type AdminNavItem = (typeof ADMIN_NAV_ITEMS)[number]
type AdminNavHref = AdminNavItem['href']

const ADMIN_NAV_METADATA_KEY = 'admin_nav_order'

function restoreNavItems(initialOrder: readonly string[] | undefined): readonly AdminNavItem[] {
  if (!initialOrder?.length) return ADMIN_NAV_ITEMS
  const restoredItems = initialOrder
    .filter((href): href is AdminNavHref => ADMIN_NAV_ITEMS.some((item) => item.href === href))
    .map((href) => ADMIN_NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is AdminNavItem => item !== undefined)
  const restoredHrefs = new Set<AdminNavHref>(restoredItems.map((item) => item.href))
  const missingItems = ADMIN_NAV_ITEMS.filter((item) => !restoredHrefs.has(item.href))
  return restoredItems.length > 0 ? [...restoredItems, ...missingItems] : ADMIN_NAV_ITEMS
}

function isActivePath(pathname: string, href: AdminNavHref): boolean {
  return pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`))
}

interface AdminNavLinkProps {
  item: AdminNavItem
  active: boolean
  mobile?: boolean
  onDragStart?: DragEventHandler<HTMLAnchorElement>
  onDragEnd?: DragEventHandler<HTMLAnchorElement>
  onDrop?: DragEventHandler<HTMLAnchorElement>
}

function AdminNavLink({ item, active, mobile = false, onDragStart, onDragEnd, onDrop }: AdminNavLinkProps) {
  const Icon = item.icon

  return (
    <Button
      asChild
      variant={active ? 'secondary' : 'ghost'}
      className="oxygen-admin-nav__link"
      data-active={active ? 'true' : undefined}
    >
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        draggable={mobile ? false : undefined}
        onDragStart={mobile ? undefined : onDragStart}
        onDragEnd={mobile ? undefined : onDragEnd}
        onDragOver={mobile ? undefined : (event) => event.preventDefault()}
        onDrop={mobile ? undefined : onDrop}
        title={mobile ? undefined : '拖动调整导航顺序'}
      >
        <Icon aria-hidden size={17} strokeWidth={1.8} />
        <span>{item.label}</span>
      </Link>
    </Button>
  )
}

export function AdminShell({ children, initialNavOrder }: { children: React.ReactNode; initialNavOrder?: readonly string[] }) {
  const pathname = usePathname()
  const [navItems, setNavItems] = useState<readonly AdminNavItem[]>(() => restoreNavItems(initialNavOrder))
  const [draggedHref, setDraggedHref] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveRequestRef = useRef(0)
  const activeItem = navItems.find((item) => isActivePath(pathname, item.href)) ?? navItems[0]

  const handleDrop = (targetHref: string) => {
    if (!draggedHref || draggedHref === targetHref) return
    const fromIndex = navItems.findIndex((item) => item.href === draggedHref)
    const toIndex = navItems.findIndex((item) => item.href === targetHref)
    if (fromIndex < 0 || toIndex < 0) return
    const nextItems = [...navItems]
    const [movedItem] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, movedItem)
    setNavItems(nextItems)
    setSaveError(null)
    const requestId = ++saveRequestRef.current
    void createClient().auth.updateUser({ data: { [ADMIN_NAV_METADATA_KEY]: nextItems.map((item) => item.href) } }).then(({ error }) => {
      if (error && requestId === saveRequestRef.current) setSaveError('导航顺序保存失败，请稍后重试。')
    })
  }

  const renderNavigation = (mobile = false) => (
    <nav className="oxygen-admin-nav" aria-label={mobile ? '移动端管理导航' : '管理端导航'}>
      {navItems.map((item) => (
        <AdminNavLink
          key={item.href}
          item={item}
          active={isActivePath(pathname, item.href)}
          mobile={mobile}
          onDragStart={() => setDraggedHref(item.href)}
          onDragEnd={() => setDraggedHref(null)}
          onDrop={(event) => {
            event.preventDefault()
            handleDrop(item.href)
            setDraggedHref(null)
          }}
        />
      ))}
    </nav>
  )

  return (
    <ConfigProvider theme="light">
      <AppShell
        className="sg-admin oxygen-admin-shell"
        title={activeItem.label}
        sidebar={
          <div className="oxygen-admin-sidebar">
            <Link className="oxygen-admin-brand" href="/admin">
              <span className="oxygen-admin-brand__mark" aria-hidden>
                <Image
                  src="/spirit-garden/个人信使图标-彩色.png"
                  alt=""
                  width={36}
                  height={36}
                  priority
                />
              </span>
              <span>
                <Typography.Title level={4}>SpiritGarden</Typography.Title>
                <Typography.Text type="secondary">管理工作台</Typography.Text>
              </span>
            </Link>
            {renderNavigation()}
            {saveError ? (
              <StatusMessage title="导航顺序未保存" tone="error">
                {saveError}
              </StatusMessage>
            ) : null}
            <Button asChild variant="secondary" className="oxygen-admin-sidebar__back">
              <Link href="/">返回前台</Link>
            </Button>
          </div>
        }
        mobileNavigation={
          <div className="oxygen-admin-mobile-nav">
            {renderNavigation(true)}
            <Button asChild variant="secondary">
              <Link href="/">返回前台</Link>
            </Button>
          </div>
        }
        topbarActions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/">返回前台</Link>
          </Button>
        }
      >
        {children}
      </AppShell>
    </ConfigProvider>
  )
}
