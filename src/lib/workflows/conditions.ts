import type { WorkflowJsonValue } from './types'
import { resolveWorkflowPath, type WorkflowExecutionContext } from './templates'

export type { WorkflowExecutionContext } from './templates'

type Token =
  | { kind: 'value'; value: WorkflowJsonValue }
  | { kind: 'path'; value: string }
  | { kind: 'operator'; value: '==' | '!=' | '>' | '>=' | '<' | '<=' | '&&' | '||' }
  | { kind: 'left' | 'right' }

type ParseResult = { ok: true; value: WorkflowJsonValue } | { ok: false; error: string }

function tokenize(expression: string): Token[] | string {
  const tokens: Token[] = []
  let index = 0
  while (index < expression.length) {
    const current = expression[index]
    if (/\s/.test(current)) {
      index += 1
      continue
    }
    if (current === '(') { tokens.push({ kind: 'left' }); index += 1; continue }
    if (current === ')') { tokens.push({ kind: 'right' }); index += 1; continue }
    const operator = expression.slice(index).match(/^(===|!==|>=|<=|==|!=|&&|\|\||>|<)/)?.[0]
    if (operator) {
      if (operator === '===' || operator === '!==') return '只支持 == 和 != 比较。'
      tokens.push({ kind: 'operator', value: operator as Token & never })
      index += operator.length
      continue
    }
    if (current === '"' || current === "'") {
      const quote = current
      let end = index + 1
      let value = ''
      while (end < expression.length && expression[end] !== quote) {
        if (expression[end] === '\\' && end + 1 < expression.length) end += 1
        value += expression[end]
        end += 1
      }
      if (expression[end] !== quote) return '字符串没有闭合。'
      tokens.push({ kind: 'value', value })
      index = end + 1
      continue
    }
    const number = expression.slice(index).match(/^-?\d+(?:\.\d+)?/)
    if (number) {
      tokens.push({ kind: 'value', value: Number(number[0]) })
      index += number[0].length
      continue
    }
    const word = expression.slice(index).match(/^[A-Za-z_][A-Za-z0-9_.-]*/)?.[0]
    if (word) {
      if (word === 'true' || word === 'false') tokens.push({ kind: 'value', value: word === 'true' })
      else if (word === 'null') tokens.push({ kind: 'value', value: null })
      else tokens.push({ kind: 'path', value: word })
      index += word.length
      continue
    }
    return `无法识别条件字符：${current}`
  }
  return tokens
}

class ConditionParser {
  private index = 0

  constructor(private readonly tokens: Token[], private readonly context: WorkflowExecutionContext) {}

  parse(): ParseResult {
    const result = this.parseOr()
    if (!result.ok) return result
    if (this.index !== this.tokens.length) return { ok: false, error: '条件表达式存在多余内容。' }
    if (typeof result.value !== 'boolean') return { ok: false, error: '条件表达式必须返回布尔值。' }
    return result
  }

  private parseOr(): ParseResult {
    let left = this.parseAnd()
    while (left.ok && this.peekOperator('||')) {
      this.index += 1
      const right = this.parseAnd()
      if (!right.ok) return right
      left = { ok: true, value: Boolean(left.value) || Boolean(right.value) }
    }
    return left
  }

  private parseAnd(): ParseResult {
    let left = this.parseComparison()
    while (left.ok && this.peekOperator('&&')) {
      this.index += 1
      const right = this.parseComparison()
      if (!right.ok) return right
      left = { ok: true, value: Boolean(left.value) && Boolean(right.value) }
    }
    return left
  }

  private parseComparison(): ParseResult {
    const left = this.parsePrimary()
    if (!left.ok) return left
    const token = this.tokens[this.index]
    if (!token || token.kind !== 'operator' || !['==', '!=', '>', '>=', '<', '<='].includes(token.value)) {
      return typeof left.value === 'boolean' ? left : { ok: false, error: '比较表达式缺少比较运算符。' }
    }
    this.index += 1
    const right = this.parsePrimary()
    if (!right.ok) return right
    if (['>', '>=', '<', '<='].includes(token.value) && (typeof left.value !== 'number' || typeof right.value !== 'number')) return { ok: false, error: '数值比较需要数字。' }
    const leftValue = left.value as string | number | boolean | null
    const rightValue = right.value as string | number | boolean | null
    const value = token.value === '==' ? leftValue === rightValue
      : token.value === '!=' ? leftValue !== rightValue
        : token.value === '>' ? (leftValue as number) > (rightValue as number)
          : token.value === '>=' ? (leftValue as number) >= (rightValue as number)
            : token.value === '<' ? (leftValue as number) < (rightValue as number)
              : (leftValue as number) <= (rightValue as number)
    return { ok: true, value }
  }

  private parsePrimary(): ParseResult {
    const token = this.tokens[this.index]
    if (!token) return { ok: false, error: '条件表达式缺少值。' }
    if (token.kind === 'left') {
      this.index += 1
      const result = this.parseOr()
      if (!result.ok) return result
      if (this.tokens[this.index]?.kind !== 'right') return { ok: false, error: '条件括号没有闭合。' }
      this.index += 1
      return result
    }
    if (token.kind === 'value') { this.index += 1; return { ok: true, value: token.value } }
    if (token.kind === 'path') {
      this.index += 1
      const value = resolveWorkflowPath(token.value, this.context)
      return value === undefined ? { ok: false, error: `变量路径不存在：${token.value}` } : { ok: true, value }
    }
    return { ok: false, error: '条件表达式值无效。' }
  }

  private peekOperator(value: Token['kind'] extends 'operator' ? never : string): boolean {
    const token = this.tokens[this.index]
    return token?.kind === 'operator' && token.value === value
  }
}

export function evaluateWorkflowCondition(expression: string, context: WorkflowExecutionContext): { ok: true; value: boolean } | { ok: false; error: string } {
  if (!expression.trim() || expression.length > 2_000) return { ok: false, error: '条件表达式为空或过长。' }
  const tokenized = tokenize(expression)
  if (typeof tokenized === 'string') return { ok: false, error: tokenized }
  if (tokenized.length > 100) return { ok: false, error: '条件表达式过于复杂。' }
  return new ConditionParser(tokenized, context).parse() as { ok: true; value: boolean } | { ok: false; error: string }
}
