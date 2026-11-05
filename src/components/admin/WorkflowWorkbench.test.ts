import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync('src/app/admin/workflows/page.tsx', 'utf8')
const componentSource = readFileSync('src/components/admin/workflows/WorkflowWorkbench.tsx', 'utf8')
const sidebarSource = readFileSync('src/components/admin/workflows/WorkflowSidebar.tsx', 'utf8')
const inspectorSource = readFileSync('src/components/admin/workflows/WorkflowInspector.tsx', 'utf8')
const canvasSource = readFileSync('src/components/admin/workflows/WorkflowCanvas.tsx', 'utf8')
const nodeSource = readFileSync('src/components/admin/workflows/WorkflowNode.tsx', 'utf8')
const workbenchSources = `${componentSource}\n${sidebarSource}\n${inspectorSource}\n${canvasSource}\n${nodeSource}`

describe('admin workflow entry', () => {
  it('normalizes metadata before rendering the client workbench', () => {
    expect(pageSource).toContain('normalizeWorkflowCanvas')
    expect(pageSource).toContain('normalizeWorkflowRuns')
    expect(pageSource).toContain('WorkflowWorkbench')
    expect(pageSource).toContain('readWorkflowState')
  })

  it('keeps workflow runs in a separate metadata payload', () => {
    expect(pageSource).toContain('initialRuns')
    expect(componentSource).toContain('saveWorkflowCanvas')
    expect(componentSource).toContain('persistWorkflowRuns')
    expect(componentSource).not.toContain('updateUser')
    expect(componentSource).toContain('createWorkflowRunSaveCoordinator')
  })

  it('exposes the first-phase workbench controls and inspector fields', () => {
    for (const label of ['编辑', '预览', '运行', '新建空白流程', '从模板开始', '让 AI 生成流程', '已保存']) {
      expect(workbenchSources).toContain(label)
    }
    for (const label of ['名称', '说明', '类型', '执行方式']) {
      expect(workbenchSources).toContain(label)
    }
    for (const label of ['系统提示词', 'Prompt 模板', '输出格式', '输出变量', '温度', '最大重试', '超时']) {
      expect(workbenchSources).toContain(label)
    }
    expect(inspectorSource).not.toContain('apiKey')
  })

  it('exposes stable canvas controls and connection anchors', () => {
    for (const label of ['画布', '放大', '缩小', '适配画布', '撤销', '重做']) {
      expect(workbenchSources).toContain(label)
    }
    expect(workbenchSources).toContain('连接${side ===')
    expect(workbenchSources).toContain('sg-workflow-canvas--readonly')
    expect(workbenchSources).toContain('getRunBlockReason')
  })

  it('migrates only the workflow outer UI to Oxygen', () => {
    expect(componentSource).toContain("from '@oxygen-design/patterns'")
    expect(componentSource).toContain("from '@oxygen-design/ui'")
    expect(componentSource).toContain('<PageHeader')
    expect(componentSource).not.toContain('sg-admin-eyebrow')
    expect(pageSource).toContain('StatusMessage')
    expect(pageSource).not.toContain('sg-admin-state')

    for (const sourcePart of [sidebarSource, inspectorSource, canvasSource, nodeSource]) {
      expect(sourcePart).not.toContain('@oxygen-design/')
    }
  })
})
