import { Suspense } from 'react'
import { AuthGardenShell } from '@/components/auth/AuthGardenShell'
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
    <AuthGardenShell>
      <Suspense fallback={<ForgotPasswordFormFallback />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthGardenShell>
  )
}
