import { Suspense } from 'react'
import { AuthGardenShell } from '@/components/auth/AuthGardenShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata = {
  title: '设置新密码 · SpiritGarden',
  description: '设置 SpiritGarden 的新密码。',
}

function ResetPasswordFormFallback() {
  return (
    <div className="sg-login-form" aria-hidden>
      <div className="sg-login-form__skeleton" />
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthGardenShell>
      <Suspense fallback={<ResetPasswordFormFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthGardenShell>
  )
}
