'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'
import { NavUserMenu } from '@/components/auth/NavUserMenu'
import { SiteNavMoreMenu } from '@/components/home/shell/SiteNavMoreMenu'
import { ThemeToggle } from '@/components/spirit/theme/ThemeToggle'
import { getMainNavTabsForRole, type SiteRole } from '@/lib/auth/roles'
import { isSiteNavActive, SITE_NAV_SECONDARY, SITE_ROUTES } from '@/lib/site/routes'

const COMPACT_NAV_MAX = 1024

interface NavigationProps {
  transparent?: boolean
  role: SiteRole
  email: string
}

export function Navigation({ transparent = false, role, email }: NavigationProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const tabs = getMainNavTabsForRole(role)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${COMPACT_NAV_MAX}px)`)
    const syncBodyOverflow = () => {
      document.body.style.overflow = mq.matches && menuOpen ? 'hidden' : ''
    }
    syncBodyOverflow()
    mq.addEventListener('change', syncBodyOverflow)
    return () => {
      mq.removeEventListener('change', syncBodyOverflow)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className={`sg-nav ${transparent ? 'sg-nav--transparent' : ''} ${transparent ? 'sg-enter sg-enter--0' : ''}`}>
      <div className="sg-nav-inner">
        <Link
          href={SITE_ROUTES.home}
          className="sg-nav-brand"
          aria-label="返回首页"
          onClick={closeMenu}
        >
          <Image src="/spirit-garden/个人信使图标-彩色.png" alt="" width={40} height={40} />
          <span className="max-md:hidden">SpiritGarden</span>
        </Link>

        <div className="sg-nav-links sg-nav-desktop-only">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`sg-nav-link${isSiteNavActive(pathname, tab.href) ? ' sg-nav-link--active' : ''}`}
            >
              {tab.label}
            </Link>
          ))}
          <SiteNavMoreMenu />
        </div>

        <div className="sg-nav-actions sg-nav-desktop-only">
          <Link
            href={SITE_ROUTES.search}
            className="sg-nav-search"
            aria-label="搜索站点"
          >
            <Search size={18} aria-hidden />
          </Link>
          <ThemeToggle />
          <NavUserMenu email={email} />
        </div>

        <div className="sg-nav-actions sg-nav-actions--compact sg-nav-compact-only">
          <Link
            href={SITE_ROUTES.search}
            className="sg-nav-search"
            aria-label="搜索站点"
          >
            <Search size={18} aria-hidden />
          </Link>
          <ThemeToggle />
          <button
            type="button"
            className="sg-nav-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="sg-nav-drawer"
            aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
          >
            {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>

      <div
        className={`sg-nav-overlay sg-nav-compact-only${menuOpen ? ' sg-nav-overlay--open' : ''}`}
        onClick={closeMenu}
        aria-hidden={!menuOpen}
      />
      <div
        id="sg-nav-drawer"
        className={`sg-nav-drawer sg-nav-compact-only${menuOpen ? ' sg-nav-drawer--open' : ''}`}
        role="dialog"
        aria-modal={menuOpen}
        aria-label="站点导航"
        aria-hidden={!menuOpen}
      >
        <div className="sg-nav-drawer-links">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`sg-nav-drawer-link${isSiteNavActive(pathname, tab.href) ? ' sg-nav-drawer-link--active' : ''}`}
              onClick={closeMenu}
            >
              {tab.label}
            </Link>
          ))}
          <div className="sg-nav-drawer-divider" aria-hidden />
          {SITE_NAV_SECONDARY.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`sg-nav-drawer-link sg-nav-drawer-link--secondary${isSiteNavActive(pathname, tab.href) ? ' sg-nav-drawer-link--active' : ''}`}
              onClick={closeMenu}
            >
              {tab.label}
            </Link>
          ))}
          <div className="sg-nav-drawer-divider" aria-hidden />
          <div className="sg-nav-drawer-user">
            <NavUserMenu email={email} />
          </div>
        </div>
      </div>
    </nav>
  )
}
