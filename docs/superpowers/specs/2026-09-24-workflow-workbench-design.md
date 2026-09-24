# Workflow 工作台设计规格

## 目标

在管理端增加一个个人 Workflow 工作台，把“可视化思维”逐步沉淀为“结构化流程”，并为后续“可执行工作流”保留统一的数据模型和运行契约。

第一阶段交付可编辑、可预览、可持久化的无限画布，不接入真实 AI/API 执行，避免把配置状态伪装成运行能力。

## 产品定位

同一套流程模型支持三种使用方式：

- 思维模式：只表达问题、分析、假设、判断和结论，不执行。
- 半执行模式：加入人工输入、确认、选择等暂停点。
- 全执行模式：未来接入 AI、HTTP/API、数据库、文件、Webhook 和控制节点。

编辑器负责搭建和配置流程，预览负责只读检查，运行器负责执行流程。思维节点与执行节点不是两个产品，而是同一节点模型的不同能力配置。

## 第一阶段范围

- 增加 `/admin/workflows` 管理端入口，不移除 `/admin/settings`。
- 支持多个命名流程：新建、切换、重命名、复制、删除。
- 支持无限画布：网格、平移、缩放、适配画布、节点拖拽、框选、多选、复制、删除。
- 支持五组节点：思维、人工、AI、系统、控制；第一阶段提供可配置节点，不接真实外部执行。
- 支持双击节点标题直接编辑，右侧属性面板编辑描述、类型、颜色、输入、输出和执行摘要。
- 支持节点锚点连线、边删除、条件标签；判断节点提供“是 / 否”出口。
- 支持 `[编辑] [预览] [运行]` 三种模式。预览只读；运行只允许进入已配置节点，遇到未配置能力要明确阻断原因。
- 首次打开显示左侧流程列表、中间空白画布和三个快捷入口：新建空白流程、从模板开始、让 AI 生成流程。模板和 AI 入口在第一阶段进入明确的占位状态，不生成虚假数据。
- 保存到 Supabase Auth 当前用户的 `user_metadata.workflow_canvas`，跨设备恢复。

## 页面布局

### 桌面端

页面使用三栏结构：

1. 左栏：流程列表、流程操作、节点面板，按思维 / 人工 / AI / 系统 / 控制分组。
2. 中栏：无限画布，顶部提供模式切换和画布操作，底部提供缩放、对齐、撤销、重做和小地图入口。
3. 右栏：节点属性。桌面端可收起，画布在收起后扩展。

节点从左栏拖到画布创建；从节点边缘锚点拖到目标节点创建边；选中边后编辑条件标签。空白画布提供快捷入口。

### 移动端

移动端不强行保留三栏：左栏变成底部节点抽屉，右栏变成底部属性抽屉，画布保持可平移缩放。流程列表通过顶部抽屉切换，保证节点文字和操作按钮不重叠。

## 统一数据模型

```ts
type WorkflowCanvasMetadata = {
  version: 1
  activeWorkflowId: string | null
  workflows: WorkflowDocument[]
}

type WorkflowDocument = {
  version: 1
  id: string
  name: string
  description: string
  inputs: WorkflowPort[]
  variables: WorkflowVariable[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  settings: {
    entryNodeId: string | null
    errorPolicy: 'stop' | 'continue'
  }
  viewport: { x: number; y: number; zoom: number }
  updatedAt: string
}

type WorkflowNode = {
  id: string
  kind: 'thinking' | 'human' | 'ai' | 'system' | 'control'
  subtype: string
  position: { x: number; y: number }
  title: string
  description: string
  color: 'green' | 'gold' | 'rose' | 'blue' | 'slate'
  config: Record<string, string | boolean | number>
  inputs: WorkflowPort[]
  outputs: WorkflowPort[]
  execution: {
    mode: 'manual' | 'configured' | 'disabled'
    provider?: 'ai' | 'http' | 'database' | 'file' | 'webhook'
  }
}

type WorkflowEdge = {
  id: string
  source: { nodeId: string; portId: string }
  target: { nodeId: string; portId: string }
  condition?: { label: string; expression?: string }
}
```

`WorkflowPort` 和 `WorkflowVariable` 是带名称、类型和可选描述的结构化字段，后续用于输入输出映射。`config` 只保存可分享的配置和变量引用，不保存 API Key、Supabase 密钥或其他机密。

节点升级只改变 `kind`、`subtype` 和 `execution`，保留标题、说明、位置和已建立的边；因此“普通判断”可以后续升级为 AI 判断，“普通调用”可以后续配置为 HTTP 节点。

## 持久化与错误处理

- Server Component 从 `requireSuperAdmin()` 得到当前用户的初始 `user_metadata`，只把已归一化的安全数据传给客户端工作台。
- 客户端变更先乐观更新本地状态，再通过防抖的 `auth.updateUser({ data: { workflow_canvas } })` 保存。
- 保存请求使用递增序号；旧请求返回不能覆盖新状态。
- 保存失败保留画布内容，显示错误状态和“重试保存”操作，不使用 `alert`。
- 读取时检查顶层版本、流程 ID、节点 kind、坐标和边引用；未知版本或坏流程回退为可编辑的空流程，不能导致管理端白屏。
- 离开页面或切换流程时，如果存在未保存请求，显示轻量未保存提示并等待当前保存完成。

## 后续阶段

### 第二阶段：流程播放器与人工节点

按拓扑执行，支持人工输入、确认、选择暂停，保存运行变量并恢复中断运行。

### 第三阶段：AI、API、数据节点

接入 AI Prompt/模型、HTTP/API、输入输出变量映射、条件表达式、重试和异常分支。机密配置使用安全的服务端引用，不进入 Auth 元数据。

### 第四阶段：AI 搭流程、模板和组件库

自然语言生成流程、节点升级、模板/组件复用、发布与版本管理。

## 验证策略

- 单元测试：数据归一化、坏数据回退、节点和边增删、流程复制、连线约束、模式切换、保存竞态。
- 源码测试：管理端导航包含 `/admin/workflows`，原有 `/admin/settings` 保留。
- 类型与 lint：新增组件和工作流类型通过项目 TypeScript、ESLint。
- 浏览器验证：管理员会话下检查首次空状态、创建流程、拖拽节点、双击编辑、连线、流程切换和刷新后的恢复；未配置 AI/API 只显示阻断状态。
- 证据分开记录：定向单测、类型检查、构建、浏览器验证和真实 Supabase 保存不互相替代。

## 非目标

第一阶段不做多人协作、版本历史、真实 AI/API 执行、密钥管理、运行日志、服务端流程队列或跨用户共享。
