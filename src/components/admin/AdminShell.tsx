'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
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

export function AdminShell({ children, initialNavOrder }: { children: React.ReactNode; initialNavOrder?: readonly string[] }) {
  const pathname = usePathname()
  const [navItems, setNavItems] = useState<readonly AdminNavItem[]>(() => restoreNavItems(initialNavOrder))
  const [draggedHref, setDraggedHref] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveRequestRef = useRef(0)

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

  return (
    <div className="sg-admin">
      <aside className="sg-admin__sidebar">
        <Link className="sg-admin__brand" href="/admin">
          <span className="sg-admin__brand-mark" aria-hidden>
            <Image
              src="/spirit-garden/个人信使图标-彩色.png"
              alt=""
              width={34}
              height={34}
              priority
            />
          </span>
          <span>
            <strong>SpiritGarden</strong>
            <small>管理工作台</small>
          </span>
        </Link>
        <nav className="sg-admin__nav" aria-label="管理端导航">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              className={`sg-admin__nav-link${pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`)) ? ' sg-admin__nav-link--active' : ''}`}
              href={href}
              key={href}
              aria-current={pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`)) ? 'page' : undefined}
              draggable
              onDragStart={() => setDraggedHref(href)}
              onDragEnd={() => setDraggedHref(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                handleDrop(href)
                setDraggedHref(null)
              }}
              title="拖动调整导航顺序"
            >
              <Icon aria-hidden size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        {saveError ? <p className="sg-admin__nav-error" role="status">{saveError}</p> : null}
        <Link className="sg-admin__back" href="/">
          返回前台
        </Link>
      </aside>
      <main className="sg-admin__main">{children}</main>
    </div>
  )
}
