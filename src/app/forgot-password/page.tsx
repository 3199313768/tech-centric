import Image from 'next/image'
import { Suspense } from 'react'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata = {
  title: '忘记密码 · SpiritGarden',
  description: '通过邮箱重置 SpiritGarden 密码。',
}

function ForgotPasswordFormFallback() {
  return (
    <div className="sg-login-form" aria-hidden>
      <div className="sg-login-form__skeleton" />
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="sg-login">
      <aside className="sg-login-brand" aria-label="SpiritGarden">
        <Image
          src="/spirit-garden/hero-landscape.png"
          alt=""
          fill
          priority
          className="sg-login-brand__image"
          sizes="(max-width: 767px) 100vw, 55vw"
        />
        <div className="sg-login-brand__veil" aria-hidden />
        <div className="sg-login-brand__content sg-login-enter sg-login-enter--0">
          <Image
            src="/spirit-garden/个人信使图标-彩色.png"
            alt=""
            width={48}
            height={48}
            className="sg-login-brand__logo"
            unoptimized
          />
          <p className="sg-login-brand__name">SpiritGarden</p>
          <p className="sg-login-brand__lead">园主的数字庭院</p>
        </div>
      </aside>

      <main className="sg-login-panel">
        <div className="sg-login-panel__inner sg-login-enter sg-login-enter--1">
          <Suspense fallback={<ForgotPasswordFormFallback />}>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
