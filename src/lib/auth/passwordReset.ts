import { isSafeNextPath } from '@/lib/auth/roles'

export const PASSWORD_RESET_ROUTES = {
  forgot: '/forgot-password',
  reset: '/reset-password',
  callback: '/auth/callback',
} as const

export const PASSWORD_RESET_MESSAGES = {
  invalidEmail: '请输入完整邮箱地址',
  sendSuccess: '如果该邮箱已注册，重置链接将发送到邮箱',
  sendError: '暂时无法发送重置邮件，请稍后重试',
  rateLimited: '请求过于频繁，请稍后再试',
  invalidLink: '重置链接无效或已过期',
  passwordMismatch: '两次输入的密码不一致',
  updateError: '暂时无法更新密码，请稍后重试',
  updateSuccess: '密码已更新，请使用新密码登录',
} as const

export function isPasswordResetRateLimited(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 429
  )
}

export function isValidResetEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function resolveResetNextPath(value: string | null | undefined): string {
  return isSafeNextPath(value) ? value : PASSWORD_RESET_ROUTES.reset
}

export function buildPasswordResetRedirect(origin: string): string {
  return `${origin}${PASSWORD_RESET_ROUTES.callback}?next=${encodeURIComponent(PASSWORD_RESET_ROUTES.reset)}`
}
