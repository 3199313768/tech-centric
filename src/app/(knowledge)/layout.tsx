import { AccountSetupRequired } from '@/components/auth/AccountSetupRequired'
import { KnowledgeNav } from '@/components/knowledge/shell/KnowledgeNav'
import { SpiritAtmosphereShell } from '@/components/spirit/shell/SpiritAtmosphereShell'
import { getSessionState } from '@/lib/auth/getSessionProfile'
import { redirect } from 'next/navigation'

export default async function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const state = await getSessionState()
  if (state.kind === 'anonymous') redirect('/login')
  if (state.kind === 'incomplete') {
    return <AccountSetupRequired email={state.email} />
  }

  return (
    <SpiritAtmosphereShell
      nav={
        <KnowledgeNav
          role={state.profile.role}
          email={state.profile.user.email ?? ''}
        />
      }
    >
      {children}
    </SpiritAtmosphereShell>
  )
}
