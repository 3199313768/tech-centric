import { describe, expect, it } from 'vitest'
import { evaluateWorkflowCondition, type WorkflowExecutionContext } from './conditions'

const context: WorkflowExecutionContext = {
  inputs: { score: 3, topic: '发布' },
  variables: { approved: true },
  nodes: {},
}

describe('workflow conditions', () => {
  it('evaluates comparisons and logical combinations', () => {
    expect(evaluateWorkflowCondition('inputs.score >= 3 && variables.approved == true', context)).toEqual({ ok: true, value: true })
    expect(evaluateWorkflowCondition('inputs.topic == "发布" || variables.approved == false', context)).toEqual({ ok: true, value: true })
  })

  it('rejects functions and unknown paths', () => {
    expect(evaluateWorkflowCondition('inputs.topic.includes("x")', context).ok).toBe(false)
    expect(evaluateWorkflowCondition('variables.missing == true', context).ok).toBe(false)
    expect(evaluateWorkflowCondition('inputs.score + 1 > 3', context).ok).toBe(false)
  })
})
