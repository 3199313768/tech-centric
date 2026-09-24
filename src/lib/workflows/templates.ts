import type { WorkflowJsonValue, WorkflowValueMap } from './types'

export type WorkflowExecutionContext = {
  inputs: WorkflowValueMap
  variables: WorkflowValueMap
  nodes: Record<string, { output: WorkflowJsonValue }>
}

type TemplateResult = { ok: true; text: string } | { ok: false; error: string }

const SAFE_PATH_PART = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/
const MAX_TEMPLATE_TOKENS = 100
const MAX_RENDERED_LENGTH = 12_000

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function readNested(value: WorkflowJsonValue, parts: string[]): WorkflowJsonValue | undefined {
  let current: WorkflowJsonValue = value
  for (const part of parts) {
    if (!SAFE_PATH_PART.test(part) || current === null || typeof current !== 'object' || Array.isArray(current) || !hasOwn(current, part)) return undefined
    current = current[part]
  }
  return current
}

export function resolveWorkflowPath(path: string, context: WorkflowExecutionContext): WorkflowJsonValue | undefined {
  const parts = path.trim().split('.')
  const root = parts.shift()
  if (!root || parts.length < 1) return undefined
  if ((root === 'inputs' || root === 'variables') && SAFE_PATH_PART.test(parts[0])) {
    if (!hasOwn(context[root], parts[0])) return undefined
    return readNested(context[root][parts[0]], parts.slice(1)) ?? (parts.length === 1 ? context[root][parts[0]] : undefined)
  }
  if (root !== 'nodes' || parts.length < 2 || !SAFE_PATH_PART.test(parts[0]) || parts[1] !== 'output' || !hasOwn(context.nodes, parts[0])) return undefined
  const output = context.nodes[parts[0]].output
  return readNested(output, parts.slice(2)) ?? (parts.length === 2 ? output : undefined)
}

function stringifyValue(value: WorkflowJsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function renderWorkflowTemplate(template: string, context: WorkflowExecutionContext): TemplateResult {
  if (template.length > MAX_RENDERED_LENGTH) return { ok: false, error: 'Prompt 模板过长。' }
  let tokens = 0
  let rendered: string
  try {
    rendered = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, path: string) => {
      tokens += 1
      if (tokens > MAX_TEMPLATE_TOKENS) return ''
      const value = resolveWorkflowPath(path, context)
      if (value === undefined) throw new Error(`变量路径不存在：${path.trim()}`)
      return stringifyValue(value)
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Prompt 模板变量无效。' }
  }
  if (tokens > MAX_TEMPLATE_TOKENS) return { ok: false, error: 'Prompt 模板变量过多。' }
  if (/\{\{|\}\}/.test(rendered)) return { ok: false, error: 'Prompt 模板语法不完整。' }
  if (rendered.length > MAX_RENDERED_LENGTH) return { ok: false, error: '渲染后的 Prompt 过长。' }
  return { ok: true, text: rendered }
}
