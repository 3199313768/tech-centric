# Workflow 第三阶段：AI 节点与服务端执行

## 目标

在第二阶段人工节点播放器的基础上，增加安全的 AI 节点服务端执行能力，使流程可以完成“人工输入 → AI 处理 → 人工确认”的半自动工作流。第三阶段只接入项目现有的 DeepSeek 服务端客户端；HTTP/API、数据库、文件和 Webhook provider 保留契约但继续明确为未启用。

## 已确认的边界

- 执行架构采用 Route Handler + 服务端 DeepSeek 客户端。
- AI 节点使用平台服务端的 `DEEPSEEK_API_KEY`。
- `user_metadata.workflow_canvas` 只保存 Prompt、参数和变量引用，不保存密钥、JWT、完整凭证或任意上游 URL。
- `user_metadata.workflow_runs` 保存运行状态、AI 节点结果摘要、尝试次数和可恢复错误状态。
- 管理端 API 只允许当前 super admin 调用，并且服务端从当前用户 metadata 重新读取流程配置，不信任客户端上传的完整节点配置。
- 不使用 Mock 数据冒充 AI 成功；缺少服务端 key、配置无效或上游失败都进入明确错误状态。

## 方案选择

### 方案 A：Route Handler + 服务端 DeepSeek 客户端（采用）

客户端只发起运行请求并展示状态；Route Handler 使用 `requireApiSuperAdmin()` 验证身份，从用户 metadata 读取并归一化流程，调用已有 `deepseekChatCompletion`，返回经过约束的执行结果。这个边界复用现有超时、Abort、代理和错误处理，同时不会把密钥带到浏览器。

### 方案 B：Server Action 直接执行

代码量可能更少，但执行协议会和工作台组件耦合，不利于后续 HTTP/API provider、队列和独立执行测试，因此不采用。

### 方案 C：队列/Worker 执行

适合长任务、后台执行和审计，但需要新增队列、数据库状态和 worker 生命周期，超出个人半自动流程的第三阶段范围。

## 数据模型升级

### 安全 JSON 值

节点配置从只允许基础值扩展为可归一化的 JSON 值，禁止函数、原型对象和二进制内容：

```ts
type WorkflowJsonValue =
  | string
  | number
  | boolean
  | null
  | WorkflowJsonValue[]
  | { [key: string]: WorkflowJsonValue }
```

已有节点配置保持向后兼容；未知结构读取时归一化为安全默认值。

### AI 执行配置

```ts
type WorkflowAiConfig = {
  provider: 'deepseek'
  systemPrompt: string
  promptTemplate: string
  temperature: number
  responseFormat: 'text' | 'json'
  outputVariable: string
  maxRetries: number
  timeoutMs: number
}
```

配置只引用 `inputs.*`、`variables.*` 和 `nodes.<id>.output`，不包含 API Key、URL、请求头或服务端环境变量名。

### 运行状态

在现有 `WorkflowRun` 上增加：

```ts
type WorkflowExecutionStatus = 'idle' | 'executing' | 'retrying'

type WorkflowExecutionAttempt = {
  nodeId: string
  status: 'success' | 'failed'
  attempt: number
  retryable: boolean
  error: string | null
  at: string
}
```

运行快照增加 `executionStatus`、`executionNodeId`、`attempts` 和受限的 AI 输出变量。完整 Prompt、原始响应、Authorization header 和服务端异常堆栈不得写入 Auth metadata。

## 执行链路

1. 客户端纯运行器遇到已配置的 AI 节点，将运行置为 `executing`，记录 `executionNodeId`，暂停普通拓扑推进。
2. 客户端 `POST /api/admin/workflows/execute`，请求体只包含 `workflowId`、`runId`、`nodeId`、当前输入和变量快照的受限值。
3. Route Handler 调用 `requireApiSuperAdmin()`；未通过时返回统一 401/403，不泄露流程内容。
4. 服务端读取当前用户的 `workflow_canvas`，通过 `normalizeWorkflowCanvas` 归一化，并校验流程、运行和节点 ID；节点必须是 `kind: 'ai'`、provider 为 `deepseek` 且执行方式为 `configured`。
5. 服务端解析模板和输入映射，限制 Prompt 长度、变量数量和单次响应大小；调用已有 DeepSeek 客户端并传入 Abort/timeout。
6. 服务端只返回结构化的 `output`、可写入变量、usage 摘要、`retryable` 和用户可见错误；不返回密钥、原始请求、完整上游错误或内部路径。
7. 客户端将结果写入 `workflow_runs`，成功时沿 `out` 继续，失败且存在错误出口时沿 `error` 继续，否则标记 `failed`。

Route Handler 不直接替客户端写 Auth metadata，避免客户端执行状态和服务端请求互相覆盖；运行状态仍由现有独立的 `workflow_runs` 保存协调器持久化。

## 模板、输出与条件

### 模板插值

只支持显式路径：

- `{{inputs.topic}}`
- `{{variables.approved}}`
- `{{nodes.node-id.output}}`

缺失路径返回配置错误，不静默拼入 `undefined`。插值器不得使用 `eval`、`Function` 或任意 JavaScript。

### AI 输出

- `text` 格式写入配置的 `outputVariable`，长度超过限制即失败。
- `json` 格式必须经过 JSON 解析；只接受 JSON object/array，解析失败进入错误流程。
- 变量映射只允许安全 JSON 值，并限制深度、键数和总字节数。

### 条件表达式

条件只允许白名单路径、字面量和以下运算符：`==`、`!=`、`>`、`>=`、`<`、`<=`、`&&`、`||`。解析器使用明确的 tokenizer/parser，不执行 JavaScript；语法错误或访问未声明路径时返回条件错误并走错误策略。

## 重试与错误分支

- 默认每个 AI 节点最多重试 2 次，采用有限指数退避。
- 超时、网络错误和 429/5xx 标记为 `retryable`；鉴权、配置、模板、JSON 解析和权限错误不自动重试。
- AI 节点拥有 `out` 与 `error` 出口；错误出口没有连线时，运行进入 `failed` 并保留可重试快照。
- 每次尝试仅保存节点 ID、次数、状态、是否可重试、用户可见错误摘要和时间，不保存完整 Prompt/响应。
- 运行播放器提供“重试当前节点”和“走错误分支”；重试不会重复执行已经成功的前置节点。

## 管理端交互

- Inspector 在 AI 节点上显示 Prompt、系统提示、温度、输出格式、输出变量、超时和最大重试次数。
- 配置字段有长度和范围校验；`temperature`、`timeoutMs`、`maxRetries` 使用数值控件，不接受任意文本。
- 播放器显示 `执行中`、`重试中`、`已完成`、`失败`，禁止重复提交同一个执行请求。
- 缺少 `DEEPSEEK_API_KEY` 或节点配置不完整时，播放器显示明确错误，不回退假数据。
- HTTP、数据库、文件和 Webhook 节点继续显示“后续阶段未启用”，不会进入真实调用。

## 安全与可靠性

- API 使用 `requireApiSuperAdmin()`，服务端重新读取并校验用户流程配置。
- Route Handler 限制请求体大小、Prompt 长度、变量数量、响应大小和执行超时。
- 不接受客户端传入的任意 provider URL、Authorization header 或模型 endpoint。
- 用户变量按文本/JSON 值处理，不插入 HTML；日志只记录节点 ID、运行 ID、耗时和错误类别。
- 请求取消时 Abort 上游调用；重复请求使用 `runId + nodeId + attempt` 约束，旧响应不能覆盖新运行状态。
- 所有 `{ data, error }`、网络异常和 JSON 解析异常都必须进入可见错误状态，不使用 `alert`。

## 测试与验收

### 纯函数

- JSON 配置归一化和旧版本兼容。
- Prompt 路径插值、缺失变量和长度限制。
- 安全条件 tokenizer/parser，覆盖比较、逻辑组合、非法函数调用和越权路径。
- AI 输出 text/JSON 解析、变量映射和大小限制。
- 重试判定、退避次数、不可重试错误和 `out/error` 分支。

### Route Handler

- 非 super admin 被拒绝。
- 客户端篡改 provider、workflow/node ID 或 URL 时被拒绝。
- DeepSeek 客户端 mock 成功、超时、429、5xx、无 key、空响应和非法 JSON。
- 响应不包含 API Key、Authorization、完整 Prompt 或内部堆栈。

### 组件与浏览器

- Inspector 保存 AI 配置并显示范围错误。
- 播放器显示执行中、重试中、失败、重试当前节点和错误分支。
- 管理员会话下验证人工输入 → AI → 人工确认的恢复流程。
- 有效 `DEEPSEEK_API_KEY` 下单独记录真实服务端调用；没有有效 key 时只验证安全错误状态，不将未调用误报为成功。

## 非目标

- HTTP/API、数据库、文件、Webhook 的真实执行。
- 用户自带密钥、密钥管理后台和多租户 provider 配置。
- 多人协作、服务端队列、长时间后台任务和完整运行日志平台。

