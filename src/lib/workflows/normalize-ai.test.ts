import { describe, expect, it } from 'vitest'
import { normalizeWorkflowAiConfig } from './normalize'

describe('workflow ai config normalization', () => {
  it('normalizes a bounded DeepSeek config', () => {
    expect(normalizeWorkflowAiConfig({
      provider: 'deepseek',
      promptTemplate: 'Summarize {{inputs.topic}}',
      temperature: 0.4,
      responseFormat: 'json',
      outputVariable: 'summary',
      maxRetries: 2,
      timeoutMs: 20_000,
    })).toMatchObject({ provider: 'deepseek', temperature: 0.4, maxRetries: 2 })
  })

  it('rejects client-side secrets and unbounded values', () => {
    expect(normalizeWorkflowAiConfig({ apiKey: 'secret', endpoint: 'https://evil.test', timeoutMs: 999_999 })).toBeNull()
  })

  it('preserves a safe default for optional prompt settings', () => {
    expect(normalizeWorkflowAiConfig({ provider: 'deepseek', promptTemplate: 'Hello' })).toEqual({
      provider: 'deepseek',
      systemPrompt: '',
      promptTemplate: 'Hello',
      temperature: 0.2,
      responseFormat: 'text',
      outputVariable: 'ai_output',
      maxRetries: 2,
      timeoutMs: 30_000,
    })
  })
})
