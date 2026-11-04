'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { useState } from 'react'

const AuthDioramaScene = dynamic(
  () =>
    import('@/components/home/landing/DioramaScene').then(
      ({ DioramaScene }) => DioramaScene,
    ),
  {
    ssr: false,
    loading: () => (
      <img
        className="sg-diorama-fallback"
        src="/spirit-garden/hero-landscape.png"
        alt="数字庭院"
      />
    ),
  },
)

interface AuthGardenShellProps {
  children: ReactNode
}

export function AuthGardenShell({ children }: AuthGardenShellProps) {
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className={`sg-auth-garden${panelOpen ? '' : ' sg-auth-garden--exploring'}`}>
      <div className="sg-auth-garden__scene">
        <AuthDioramaScene
          fallbackSrc="/spirit-garden/hero-landscape.png"
          showStoryNodes={false}
        />
      </div>

      <aside className="sg-auth-garden__brand" aria-label="SpiritGarden">
        <Image
          src="/spirit-garden/个人信使图标-彩色.png"
          alt=""
          width={44}
          height={44}
          className="sg-auth-garden__logo"
          unoptimized
        />
        <span className="sg-auth-garden__name">SpiritGarden</span>
        <small className="sg-auth-garden__lead">园主的数字庭院</small>
        <p className="sg-auth-garden__claim">走进庭院，继续你的故事。</p>
      </aside>

      <div className="sg-auth-garden__canvas-tools">
        <button
          type="button"
          className="sg-auth-garden__toggle"
          aria-controls="auth-garden-panel"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((current) => !current)}
        >
          {panelOpen ? '探索庭院' : '返回登录'}
        </button>
      </div>

      <main
        id="auth-garden-panel"
        className="sg-auth-garden__panel"
        aria-hidden={!panelOpen}
        inert={!panelOpen}
      >
        <div className="sg-auth-garden__panel-inner">{children}</div>
      </main>
    </div>
  )
}
