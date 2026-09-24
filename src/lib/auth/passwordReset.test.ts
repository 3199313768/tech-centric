import { describe, expect, it } from 'vitest'
import {
  buildPasswordResetRedirect,
  isValidResetEmail,
  isPasswordResetRateLimited,
  resolveResetNextPath,
} from '@/lib/auth/passwordReset'

describe('password reset helpers', () => {
  it('accepts a complete email and rejects blank or malformed values', () => {
    expect(isValidResetEmail('owner@example.com')).toBe(true)
    expect(isValidResetEmail(' owner@example.com ')).toBe(true)
    expect(isValidResetEmail('owner')).toBe(false)
    expect(isValidResetEmail('owner@')).toBe(false)
    expect(isValidResetEmail('')).toBe(false)
  })

  it('keeps safe reset paths and rejects external redirects', () => {
    expect(resolveResetNextPath('/reset-password')).toBe('/reset-password')
    expect(resolveResetNextPath('https://evil.example')).toBe('/reset-password')
    expect(resolveResetNextPath('//evil.example')).toBe('/reset-password')
    expect(resolveResetNextPath(null)).toBe('/reset-password')
  })

  it('builds a callback URL from the current origin', () => {
    expect(buildPasswordResetRedirect('https://app.example')).toBe(
      'https://app.example/auth/callback?next=%2Freset-password',
    )
  })

  it('identifies Supabase rate-limit errors', () => {
    expect(isPasswordResetRateLimited({ status: 429 })).toBe(true)
    expect(isPasswordResetRateLimited({ status: 400 })).toBe(false)
    expect(isPasswordResetRateLimited(new Error('network failure'))).toBe(false)
  })
})
