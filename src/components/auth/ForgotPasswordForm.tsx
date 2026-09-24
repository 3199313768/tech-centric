'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  buildPasswordResetRedirect,
  isPasswordResetRateLimited,
  isValidResetEmail,
  PASSWORD_RESET_MESSAGES,
} from '@/lib/auth/passwordReset'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const searchParams = useSearchParams()
  const supabase = createClient()
  const callbackError = searchParams.get('error') === 'invalid-link'

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    const normalizedEmail = email.trim()
    if (!isValidResetEmail(normalizedEmail)) {
      setError(PASSWORD_RESET_MESSAGES.invalidEmail)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: buildPasswordResetRedirect(window.location.origin) },
      )

      if (!mountedRef.current) return

      if (resetError) {
        setError(
          isPasswordResetRateLimited(resetError)
            ? PASSWORD_RESET_MESSAGES.rateLimited
            : PASSWORD_RESET_MESSAGES.sendError,
        )
        setLoading(false)
        return
      }

      setSent(true)
      setLoading(false)
    } catch (requestError) {
      if (!mountedRef.current) return
      setError(
        isPasswordResetRateLimited(requestError)
          ? PASSWORD_RESET_MESSAGES.rateLimited
          : PASSWORD_RESET_MESSAGES.sendError,
      )
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="sg-login-form">
        <h1 className="sg-login-form__title">邮件已发送</h1>
        <p className="sg-login-form__subtitle" aria-live="polite">
          {PASSWORD_RESET_MESSAGES.sendSuccess}
        </p>
        <Link className="sg-login-form__link" href="/login">
          返回登录
        </Link>
      </div>
    )
  }

  return (
    <div className="sg-login-form">
      <h1 className="sg-login-form__title">忘记密码</h1>
      <p className="sg-login-form__subtitle">
        输入完整邮箱，我们会发送密码重置链接。
      </p>

      {callbackError ? (
        <div className="sg-kb-error sg-kb-error--inline" role="alert">
          <p>{PASSWORD_RESET_MESSAGES.invalidLink}</p>
        </div>
      ) : null}

      <form className="sg-login-form__fields" onSubmit={handleSubmit}>
        <div className="sg-form-field">
          <label className="sg-form-label" htmlFor="reset-email">
            邮箱
          </label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="sg-form-input"
            required
            autoComplete="email"
            placeholder="name@example.com"
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
          {loading ? '发送中...' : '发送重置邮件'}
        </button>
      </form>

      <Link className="sg-login-form__link" href="/login">
        返回登录
      </Link>
    </div>
  )
}
