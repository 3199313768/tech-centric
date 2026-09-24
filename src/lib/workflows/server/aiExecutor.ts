import { deepseekChatCompletion } from '@/lib/deepseek/client'
import { parseAiOutput } from '../aiResult'
import type { WorkflowAiConfig, WorkflowJsonValue } from '../types'

export type ExecuteWorkflowAiInput = {
  config: WorkflowAiConfig
  systemPrompt: string
  prompt: string
  attempt: number
  signal?: AbortSignal
}

export type ExecuteWorkflowAiResult =
  | { ok: true; output: WorkflowJsonValue; usage: { inputChars: number; outputChars: number }; retryable: false }
  | { ok: false; error: string; retryable: boolean; status?: number }

function getStatus(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : ''
  const match = message.match(/(?:failed:|status)\s*(\d{3})/i)
  return match ? Number(match[1]) : undefined
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /timeout|aborted/i.test(error.message))
}

function toSafeError(error: unknown, status?: number): { error: string; retryable: boolean } {
  if (error instanceof Error && /DEEPSEEK_API_KEY is not configured/i.test(error.message)) return { error: 'AI 服务未配置，请联系管理员。', retryable: false }
  if (isAbort(error)) return { error: 'AI 执行超时，可重试。', retryable: true }
  const retryable = status === 429 || (status !== undefined && status >= 500) || (error instanceof Error && /network|fetch|connect|socket/i.test(error.message))
  return { error: retryable ? 'AI 服务暂时不可用，可重试。' : 'AI 执行失败，请检查节点配置。', retryable }
}

export async function executeWorkflowAi(input: ExecuteWorkflowAiInput): Promise<ExecuteWorkflowAiResult> {
  if (!process.env.DEEPSEEK_API_KEY) return { ok: false, error: 'AI 服务未配置，请联系管理员。', retryable: false }
  const inputChars = input.systemPrompt.length + input.prompt.length
  try {
    const raw = await deepseekChatCompletion({
      messages: [
        ...(input.systemPrompt ? [{ role: 'system' as const, content: input.systemPrompt }] : []),
        { role: 'user', content: input.prompt },
      ],
      temperature: input.config.temperature,
      timeoutMs: input.config.timeoutMs,
      signal: input.signal,
      ...(input.config.responseFormat === 'json' ? { responseFormat: { type: 'json_object' as const } } : {}),
    })
    const parsed = parseAiOutput(raw, input.config.responseFormat)
    if (!parsed.ok) return parsed
    return { ok: true, output: parsed.value, usage: { inputChars, outputChars: raw.length }, retryable: false }
  } catch (error) {
    const status = getStatus(error)
    const safe = toSafeError(error, status)
    return { ok: false, ...safe, ...(status ? { status } : {}) }
  }
}
