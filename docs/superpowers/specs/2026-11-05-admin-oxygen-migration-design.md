# 后台管理 Oxygen 组件迁移设计

## 目标

将 `/admin` 管理端的普通管理界面统一迁移到 `@oxygen-design/ui` 与 `@oxygen-design/patterns`，采用 Oxygen 默认主题。保留现有路由、权限校验、Supabase 数据访问和业务交互；`/admin/workflows` 的流程画布、节点组件和运行逻辑继续使用现有实现。

## 范围

### 包含

- `/admin` 仪表盘。
- `/admin/knowledge` 知识库列表、筛选、创建、编辑和删除。
- `/admin/resources` 资源列表。
- `/admin/skills` 技能列表。
- `/admin/settings` 系统设置占位页。
- 后台布局、品牌区、侧边导航、导航拖拽排序和返回前台入口。
- `/admin/workflows` 的页面标题、工具栏、模式切换、错误和空状态等画布外层 UI。

### 不包含

- `WorkflowCanvas`、`WorkflowNode`、`WorkflowInspector`、`WorkflowPlayer` 内部交互和画布样式。
- 任何数据模型、API、权限规则、Supabase 查询或工作流执行逻辑变更。
- 非后台页面的视觉迁移。

## 组件映射

- 管理壳：`LayoutRoot`、`LayoutSider`、`LayoutContent`、`Button`、`Typography`。
- 页面结构：`PageHeader`、`Card`、`Statistic`、`EmptyState`、`StatusMessage`。
- 数据列表：`Table`，保留当前字段、链接和操作语义。
- 知识库表单：`Dialog`、`Field`、`Input`、`Textarea`、`Select`、`Button`。
- 工作流外层：`PageHeader`、`Card`、`Button`、`Tabs`、`StatusMessage`；画布作为现有子树嵌入。

组件使用必须通过现有 `@oxygen-design/ui` 和 `@oxygen-design/patterns` 公共导出完成，避免引入第二套组件库或复制组件实现。

## 数据流与行为

服务端页面继续调用现有查询函数并执行 `requireSuperAdmin`。客户端工作台继续维护筛选、草稿、编辑、删除和保存状态，仅替换呈现层组件。导航拖拽后仍通过 Supabase `auth.updateUser` 保存 `admin_nav_order`，保存失败继续展示可访问的错误状态。

表单必须保留：内容为空校验、保存中禁用、组件卸载保护、删除二次确认、Escape 关闭和 `/` 聚焦搜索框。错误、空数据和权限拒绝必须使用 Oxygen 的状态组件或等价语义结构，并保留 `role="alert"`、`role="status"` 等可访问性语义。

## 样式与主题

后台布局和普通控件使用 Oxygen 默认主题及其样式文件。迁移后清理被替换控件对 `sg-admin-*` 自定义样式的依赖；仅保留画布和迁移期间仍被使用的布局适配样式。不得新增硬编码颜色，页面级样式优先使用 Oxygen 组件的类名和设计令牌。

## 验证

- 相关 Vitest：`AdminShell`、`KnowledgeWorkbench`、后台页面及现有工作流测试。
- `pnpm lint`。
- `pnpm typecheck`。
- `git diff --check`。
- 在可用浏览器环境中检查桌面和移动宽度下的导航、表格、弹窗、空状态、错误状态和工作流外层布局；画布交互按现有测试范围验证。

## 验收标准

- 所有包含范围内的后台普通 UI 使用 Oxygen 组件或 Oxygen patterns。
- `/admin/workflows` 的流程画布和节点交互行为不变，外层 UI 使用 Oxygen。
- 路由、权限、查询、CRUD、错误处理和空状态行为保持不变。
- 知识库筛选、快捷键、表单校验、保存状态和删除确认继续可用。
- 导航排序仍可拖拽并持久化，保存失败可见且不会阻塞页面。
- 相关 lint、类型检查、测试和 diff 检查通过。
