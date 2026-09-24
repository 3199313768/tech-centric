'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PASSWORD_RESET_MESSAGES } from '@/lib/auth/passwordReset'

export function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (mountedRef.current && session) {
        setHasSession(true)
        setCheckingSession(false)
      }
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return
      setHasSession(Boolean(session))
      setCheckingSession(false)
    })

    return () => {
      mountedRef.current = false
      subscription.data.subscription.unsubscribe()
    }
  }, [supabase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    if (newPassword !== confirmPassword) {
      setError(PASSWORD_RESET_MESSAGES.passwordMismatch)
      return
    }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (!mountedRef.current) return

    if (updateError) {
      setError(PASSWORD_RESET_MESSAGES.updateError)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    if (!mountedRef.current) return
    router.replace('/login?reset=success')
    router.refresh()
  }

  if (checkingSession) {
    return (
      <div className="sg-login-form" aria-live="polite">
        <div className="sg-login-form__skeleton" aria-hidden />
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="sg-login-form">
        <h1 className="sg-login-form__title">设置新密码</h1>
        <div className="sg-kb-error sg-kb-error--inline" role="alert">
          <p>{PASSWORD_RESET_MESSAGES.invalidLink}</p>
        </div>
        <Link className="sg-login-form__link" href="/forgot-password">
          重新发送重置邮件
        </Link>
      </div>
    )
  }

  return (
    <div className="sg-login-form">
      <h1 className="sg-login-form__title">设置新密码</h1>
      <p className="sg-login-form__subtitle">请输入新密码并确认。</p>

      <form className="sg-login-form__fields" onSubmit={handleSubmit}>
        <div className="sg-form-field">
          <label className="sg-form-label" htmlFor="new-password">
            新密码
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="sg-form-input"
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div className="sg-form-field">
          <label className="sg-form-label" htmlFor="confirm-password">
            确认新密码
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="sg-form-input"
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

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
          {loading ? '保存中...' : '保存新密码'}
        </button>
      </form>
    </div>
  )
}
