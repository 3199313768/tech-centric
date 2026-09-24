import { afterEach, describe, expect, it, vi } from 'vitest'
import { deepseekChatCompletion } from '@/lib/deepseek/client'
import { executeWorkflowAi, type ExecuteWorkflowAiInput } from './aiExecutor'

vi.mock('@/lib/deepseek/client', () => ({ deepseekChatCompletion: vi.fn() }))

const config = {
  provider: 'deepseek' as const,
  systemPrompt: 'You are concise.',
  promptTemplate: 'Summarize the topic.',
  temperature: 0.2,
  responseFormat: 'text' as const,
  outputVariable: 'summary',
  maxRetries: 2,
  timeoutMs: 5_000,
}

const input: ExecuteWorkflowAiInput = { config, systemPrompt: config.systemPrompt, prompt: config.promptTemplate, attempt: 1 }

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  delete process.env.DEEPSEEK_API_KEY
})

describe('server workflow ai executor', () => {
  it('returns bounded output and usage without exposing credentials', async () => {
    process.env.DEEPSEEK_API_KEY = 'server-secret'
    vi.mocked(deepseekChatCompletion).mockResolvedValue('short answer')
    const result = await executeWorkflowAi(input)
    expect(result).toEqual({ ok: true, output: 'short answer', usage: { inputChars: 36, outputChars: 12 }, retryable: false })
    expect(JSON.stringify(result)).not.toContain('server-secret')
  })

  it('returns a non-retryable configuration error when the key is missing', async () => {
    const result = await executeWorkflowAi(input)
    expect(result).toMatchObject({ ok: false, retryable: false })
    expect(result.ok ? '' : result.error).toContain('未配置')
    expect(deepseekChatCompletion).not.toHaveBeenCalled()
  })

  it('classifies timeout and upstream 429/5xx errors as retryable', async () => {
    process.env.DEEPSEEK_API_KEY = 'server-secret'
    vi.mocked(deepseekChatCompletion).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    await expect(executeWorkflowAi(input)).resolves.toMatchObject({ ok: false, retryable: true })
    vi.mocked(deepseekChatCompletion).mockRejectedValueOnce(new Error('DeepSeek request failed: 429 rate limited'))
    await expect(executeWorkflowAi(input)).resolves.toMatchObject({ ok: false, retryable: true, status: 429 })
    vi.mocked(deepseekChatCompletion).mockRejectedValueOnce(new Error('DeepSeek request failed: 500 upstream'))
    await expect(executeWorkflowAi(input)).resolves.toMatchObject({ ok: false, retryable: true, status: 500 })
  })
})
