import { describe, expect, it } from 'vitest'
import { mapAiOutput, parseAiOutput } from './aiResult'

describe('workflow ai result mapping', () => {
  it('parses bounded JSON output and maps it to a variable', () => {
    const parsed = parseAiOutput('{"score": 1}', 'json')
    expect(parsed).toEqual({ ok: true, value: { score: 1 } })
    if (parsed.ok) expect(mapAiOutput(parsed.value, 'summary')).toEqual({ summary: { score: 1 } })
  })

  it('rejects malformed or oversized JSON output', () => {
    expect(parseAiOutput('{bad', 'json')).toMatchObject({ ok: false, retryable: false })
    expect(parseAiOutput('x'.repeat(12_001), 'text')).toMatchObject({ ok: false, retryable: false })
  })
})
