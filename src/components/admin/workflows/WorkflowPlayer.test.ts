import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/admin/workflows/WorkflowPlayer.tsx', 'utf8')

describe('workflow player contracts', () => {
  it('exposes start, resume, cancel and human waiting controls', () => {
    for (const label of ['开始运行', '继续运行', '恢复运行', '取消运行', '提交输入', '确认继续', '是', '否']) {
      expect(source).toContain(label)
    }
    expect(source).toContain('role="alert"')
    expect(source).not.toContain('window.prompt')
    expect(source).not.toContain('alert(')
  })
})
