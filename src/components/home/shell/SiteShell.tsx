'use client'

import { usePathname } from 'next/navigation'
import { Navigation } from '@/components/home/shell/Navigation'
import { SpiritAtmosphereShell } from '@/components/spirit/shell/SpiritAtmosphereShell'
import type { SiteRole } from '@/lib/auth/roles'
import { SITE_ROUTES } from '@/lib/site/routes'

interface SiteShellProps {
  children: React.ReactNode
  role: SiteRole
  email: string
}

export function SiteShell({ children, role, email }: SiteShellProps) {
  const pathname = usePathname()
  const isHome = pathname === SITE_ROUTES.home

  return (
    <SpiritAtmosphereShell
      variant={isHome ? 'home' : 'default'}
      nav={<Navigation transparent={isHome} role={role} email={email} />}
    >
      {children}
    </SpiritAtmosphereShell>
  )
}
