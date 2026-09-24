import { describe, expect, it } from 'vitest'
import { renderWorkflowTemplate, type WorkflowExecutionContext } from './templates'

const context: WorkflowExecutionContext = {
  inputs: { topic: '发布' },
  variables: { approved: true },
  nodes: { 'node-1': { output: { score: 3 } } },
}

describe('workflow template rendering', () => {
  it('renders only declared paths', () => {
    expect(renderWorkflowTemplate('主题：{{inputs.topic}} / {{variables.approved}} / {{nodes.node-1.output}}', context)).toEqual({
      ok: true,
      text: '主题：发布 / true / {"score":3}',
    })
  })

  it('rejects functions and undeclared paths', () => {
    expect(renderWorkflowTemplate('{{__proto__.x}}', context).ok).toBe(false)
    expect(renderWorkflowTemplate('{{inputs.missing}}', context).ok).toBe(false)
    expect(renderWorkflowTemplate('{{inputs.topic.includes}}', context).ok).toBe(false)
  })
})
