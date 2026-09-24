# Workflow 第二阶段：流程播放器与人工节点

## 目标

在第一阶段可视化工作台的基础上，增加一个可恢复的流程播放器，让个人思考流程可以沿图推进，并在人工输入、确认、选择和判断分支处暂停等待。第二阶段不接入真实 AI、HTTP/API、数据库、文件或 Webhook 执行，未配置的外部能力必须明确阻断，不能伪造执行结果。

## 范围与非目标

### 本阶段范围

- 以现有 `WorkflowDocument`、`WorkflowNode`、`WorkflowEdge` 和端口模型为输入。
- 从流程 `settings.entryNodeId` 开始，按有向边推进运行。
- 支持人工输入、人工确认、人工选择三类等待点。
- 判断节点采用人工选择分支：用户选择“是”或“否”后，播放器沿对应端口继续。
- 保存运行快照、输入、变量、当前节点和最近历史到当前用户的 Supabase Auth metadata。
- 刷新页面或在其他设备打开后，可以恢复未完成的运行。
- 支持开始、继续、恢复、取消和完成状态展示。
- 对环路设置步数上限，对坏运行数据安全回退。

### 非目标

- 不执行真实 AI、HTTP/API、数据库、文件、Webhook 或服务端队列任务。
- 不保存 API Key、JWT、Supabase service role 或其他机密。
- 不做多人协作、运行日志平台、版本历史、发布和跨用户共享。
- 不引入表达式语言；判断分支只由人工选择决定。

## 方案选择

### 方案 A：纯前端运行器 + Supabase metadata（采用）

运行器作为纯函数模块，客户端负责播放器状态和人工交互，运行快照写入 `user_metadata.workflow_runs`。它与第一阶段的 Auth metadata 持久化边界一致，改动小、便于单元测试，适合个人半执行流程。限制是它不适合多人协作或长时间后台任务。

### 方案 B：服务端运行器 + 数据库运行表

由服务端推进每一步并将运行状态存入数据库。可靠性和审计能力更强，但需要新增表、RLS、路由和迁移，超出本阶段个人工作流闭环的必要范围。

### 方案 C：浏览器本地运行

只在浏览器保存运行状态，开发成本最低，但无法跨设备恢复，也不符合已确认的账号元数据持久化要求，因此不采用。

## 数据模型

运行数据与画布数据分开保存，分别位于 `workflow_canvas` 和 `workflow_runs`，避免运行变化频繁重写画布。

```ts
type WorkflowValue = string | number | boolean | null
type WorkflowValueMap = Record<string, WorkflowValue>

type WorkflowRunStatus =
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

type WorkflowWaitingState = {
  nodeId: string
  kind: 'input' | 'confirm' | 'select'
  prompt: string
  options?: Array<{ value: string; label: string }>
}

type WorkflowRunHistoryItem = {
  nodeId: string
  status: 'completed' | 'waiting' | 'failed'
  output?: WorkflowValueMap
  at: string
}

type WorkflowRun = {
  version: 1
  id: string
  workflowId: string
  status: WorkflowRunStatus
  currentNodeId: string | null
  nextPortId: string | null
  inputs: WorkflowValueMap
  variables: WorkflowValueMap
  waiting: WorkflowWaitingState | null
  history: WorkflowRunHistoryItem[]
  error: string | null
  createdAt: string
  updatedAt: string
}

type WorkflowRunMetadata = {
  version: 1
  activeRunId: string | null
  runs: WorkflowRun[]
}
```

运行记录需要在读取时归一化：未知版本、无效 ID、非法状态、过长历史和不符合原始流程的节点引用都不能导致管理端白屏。默认保留有限数量的最近运行记录，并优先保留 `running`/`waiting` 运行，控制 Auth metadata 体积。

## 运行器架构

运行器模块不依赖 React 或 Supabase，提供可测试的纯函数：

- `startWorkflow(workflow, inputs)`：校验入口并创建运行快照。
- `advanceWorkflow(run, workflow)`：最多推进固定步数；完成普通人工可直接推进的节点，遇到等待点返回 `waiting`，遇到外部能力返回明确 `failed`。
- `resolveWaiting(run, response)`：校验人工响应，写入变量与历史，再继续推进。
- `cancelWorkflow(run)`：把未完成运行标记为 `cancelled`，保留最后状态。
- `getRunProgress(run, workflow)`：为播放器生成当前节点、完成节点和进度信息。

执行规则：

1. 入口优先使用 `settings.entryNodeId`；入口不存在或被删除时运行失败并说明原因。
2. 沿当前节点输出端口连接的边选择下一个节点。普通节点默认使用 `out`，判断节点使用人工选择返回的 `yes` 或 `no`。
3. `human` 节点按 `subtype` 进入输入、确认或选择等待状态；响应必须符合节点配置和端口数据类型。
4. `control/decision` 节点进入选择等待状态，选项固定为“是”和“否”，不执行表达式。
5. `ai`、`system` 或其他 `configured`/外部 provider 节点不执行外部调用，返回带节点标题的能力阻断原因。
6. 每次推进最多执行固定数量的步骤；超过上限即以失败状态结束，避免环路锁死页面。
7. 到达无后继边的节点视为完成；已完成运行不可再次解析人工响应。

## 播放器交互

运行模式使用独立播放器区域，不改变编辑器中的图数据：

- 开始运行：从当前流程入口创建快照并立即推进，直到完成、等待或失败。
- 等待输入：展示节点标题、说明、字段类型和提交控件。
- 等待确认：展示确认和取消两个明确操作。
- 等待选择：展示分支选项；判断节点显示“是/否”。
- 恢复运行：优先载入 `activeRunId` 指向的 `running`/`waiting` 运行；用户也可以从最近记录中选择恢复。
- 取消运行：保留取消状态，不删除运行记录。
- 完成/失败：展示摘要和最近历史；失败状态提供可行的重新开始入口，而不是假装重试已执行的外部能力。

编辑模式、预览模式和运行模式状态分离。运行过程中切换到编辑模式不会清除运行快照，保存画布也不会覆盖运行元数据。

## 持久化与错误处理

- 客户端先更新本地运行状态，再使用防抖协调器调用 `auth.updateUser({ data: { workflow_runs } })`。
- 保存请求带递增序号，旧请求不能覆盖新运行状态。
- 写入失败时保留内存中的最新运行快照，显示“保存失败，重试”，人工响应不丢失。
- 读取的运行必须再次根据当前流程校验；流程已被删除或节点已不存在时，运行显示为不可恢复并给出原因。
- 不使用 `alert`；错误通过播放器状态区、`role="alert"` 或行内错误样式展示。
- 不把运行输入或变量拼进 HTML；所有用户输入按文本值处理。

## 测试与验收

### 纯函数测试

- 有效入口和线性流程推进。
- 输入、确认、选择三类人工节点暂停与恢复。
- 判断节点的“是/否”人工分支。
- 无入口、坏端口、缺少后继边和外部能力阻断。
- 环路步数上限。
- 完成、失败、取消状态不可被非法响应覆盖。
- 运行 metadata 坏数据归一化和有限历史保留。

### 组件与源码测试

- 播放器显示当前节点、等待控件、进度和错误状态。
- 开始/继续/恢复/取消操作调用正确的运行器边界。
- `workflow_canvas` 与 `workflow_runs` 使用独立保存字段。
- 原有编辑、预览和导航行为保持不变。

### 浏览器与真实后端证据

- 管理员会话下创建含人工输入、确认、选择和判断分支的流程，验证暂停、恢复、取消和刷新后恢复。
- 单独记录真实 Supabase metadata 写入证据。
- Playwright/浏览器、定向单测、类型检查、构建和全量测试结果分开报告；浏览器或真实后端不可用时明确标注未验证。
