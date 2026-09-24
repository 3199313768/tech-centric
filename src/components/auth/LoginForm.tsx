'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveLoginEmail } from '@/lib/auth/loginIdentity'
import {
  isSiteRole,
  resolvePostLoginPath,
  SITE_ROLE,
  type SiteRole,
} from '@/lib/auth/roles'

export function LoginForm() {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const resetSuccess = searchParams.get('reset') === 'success'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolveLoginEmail(account),
      password,
    })

    if (signInError) {
      setError('邮箱或密码错误')
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    let role: SiteRole = SITE_ROLE.user
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (data && isSiteRole(data.role)) role = data.role
    }
    const next = searchParams.get('next')
    router.replace(resolvePostLoginPath(next, role))
    router.refresh()
  }

  return (
    <div className="sg-login-form">
      <h1 className="sg-login-form__title">登录</h1>
      <p className="sg-login-form__subtitle">使用管理员下发的账号进入庭院</p>

      {resetSuccess ? (
        <div className="sg-login-form__success" role="status" aria-live="polite">
          密码已更新，请使用新密码登录
        </div>
      ) : null}

      <form className="sg-login-form__fields" onSubmit={handleLogin}>
        <div className="sg-form-field">
          <label className="sg-form-label" htmlFor="login-account">
            账号
          </label>
          <input
            id="login-account"
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="sg-form-input"
            required
            autoComplete="username"
            placeholder="admin 或完整邮箱"
          />
        </div>
        <div className="sg-form-field">
          <label className="sg-form-label" htmlFor="login-password">
            密码
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="sg-form-input"
            required
            autoComplete="current-password"
          />
        </div>

        <Link className="sg-login-form__link" href="/forgot-password">
          忘记密码
        </Link>

        {error ? (
          <div className="sg-kb-error sg-kb-error--inline" role="alert">
            <p>{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="sg-btn sg-btn--primary sg-login-form__submit"
        >
          {loading ? '登录中...' : '进入庭院'}
        </button>
      </form>
    </div>
  )
}
