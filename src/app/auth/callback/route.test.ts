import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { GET } from '@/app/auth/callback/route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const mockedCreateClient = vi.mocked(createClient)

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('exchanges a valid code and redirects to the safe reset path', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null })
    mockedCreateClient.mockResolvedValue({
      auth: { exchangeCodeForSession },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await GET(
      new Request('http://localhost:3000/auth/callback?code=abc&next=/reset-password'),
    )

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(response.headers.get('location')).toBe('http://localhost:3000/reset-password')
  })

  it('redirects invalid callbacks back to forgot password', async () => {
    const response = await GET(new Request('http://localhost:3000/auth/callback'))

    expect(response.headers.get('location')).toContain(
      '/forgot-password?error=invalid-link',
    )
  })
})
