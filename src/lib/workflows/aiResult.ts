import type { WorkflowJsonValue, WorkflowValueMap } from './types'

const MAX_OUTPUT_LENGTH = 12_000
const MAX_JSON_DEPTH = 4
const MAX_JSON_KEYS = 64
const MAX_JSON_ARRAY = 32

type AiResult = { ok: true; value: WorkflowJsonValue } | { ok: false; error: string; retryable: false }

function isSafeJson(value: unknown, depth = 0, state = { keys: 0 }): value is WorkflowJsonValue {
  if (depth > MAX_JSON_DEPTH) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) {
    if (value.length > MAX_JSON_ARRAY) return false
    return value.every((item) => isSafeJson(item, depth + 1, state))
  }
  if (typeof value !== 'object') return false
  const entries = Object.entries(value)
  state.keys += entries.length
  if (state.keys > MAX_JSON_KEYS) return false
  return entries.every(([key, item]) => /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(key) && isSafeJson(item, depth + 1, state))
}

export function parseAiOutput(raw: string, format: 'text' | 'json'): AiResult {
  const content = raw.trim()
  if (!content || content.length > MAX_OUTPUT_LENGTH) return { ok: false, error: 'AI 输出为空或超过长度限制。', retryable: false }
  if (format === 'text') return { ok: true, value: content }
  try {
    const value: unknown = JSON.parse(content)
    if (!value || typeof value !== 'object' || !isSafeJson(value)) return { ok: false, error: 'AI JSON 输出不符合安全结构。', retryable: false }
    return { ok: true, value }
  } catch {
    return { ok: false, error: 'AI 返回的 JSON 无法解析。', retryable: false }
  }
}

export function mapAiOutput(value: WorkflowJsonValue, outputVariable: string): WorkflowValueMap {
  return { [outputVariable]: value }
}
