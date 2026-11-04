import { Suspense } from 'react'
import { AuthGardenShell } from '@/components/auth/AuthGardenShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = {
  title: '登录 · SpiritGarden',
  description: '登录后进入 SpiritGarden。',
}

function LoginFormFallback() {
  return (
    <div className="sg-login-form" aria-hidden>
      <div className="sg-login-form__skeleton" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthGardenShell>
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </AuthGardenShell>
  )
}
