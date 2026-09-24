# 忘记密码设计

## 目标

为 SpiritGarden 增加基于 Supabase Auth 邮箱重置链接的忘记密码流程。用户只能使用完整邮箱提交重置请求，邮件链接进入站内设置新密码，完成后返回登录页。

## 范围

### 包含

- 在现有 `/login` 表单增加“忘记密码”入口。
- 新增公开页面 `/forgot-password`，提交完整邮箱并发送重置链接。
- 新增公开回调 `/auth/callback`，完成 Supabase PKCE code 交换并安全跳转。
- 新增公开页面 `/reset-password`，设置并确认新密码。
- 补充认证状态、重复提交、无效链接和请求失败的界面状态。
- 增加纯函数和组件行为测试，覆盖成功、失败和重复提交场景。

### 不包含

- 不支持 `admin` 等登录账号别名找回密码；找回表单只接受完整邮箱地址。
- 不新增服务端密码策略；密码强度和最终校验由 Supabase 项目配置负责，前端只校验必填和两次输入一致。
- 不改动用户资料、角色、登录成功后的跳转规则。
- 不新增 Axios 依赖或服务端代理 API；Supabase Auth 客户端直接发起请求。

## 认证流程

1. 用户在 `/login` 点击“忘记密码”，进入 `/forgot-password`。
2. 用户输入完整邮箱并提交。表单锁定提交按钮，调用：

   ```ts
   supabase.auth.resetPasswordForEmail(email, {
     redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
   })
   ```

3. 无论邮箱是否已注册，只要 Supabase 请求没有返回错误，页面显示统一提示“如果该邮箱已注册，重置链接将发送到邮箱”，不暴露账号是否存在。
4. Supabase 邮件链接携带 `code` 进入 `/auth/callback`。Route Handler 调用 `exchangeCodeForSession(code)`，将认证 cookie 写回响应。
5. 回调只允许安全的站内 `next` 路径；缺失或非法路径统一跳转 `/reset-password`。
6. `/reset-password` 检查恢复会话。用户输入新密码和确认密码后调用：

   ```ts
   supabase.auth.updateUser({ password: newPassword })
   ```

7. 更新成功后登出当前恢复会话，并跳转 `/login?reset=success`；登录页根据参数显示一次性成功提示。

## 路由与组件

### 修改

- `src/components/auth/LoginForm.tsx`
  - 添加指向 `/forgot-password` 的无障碍链接。
  - 保持现有登录字段、错误文案和登录后跳转不变。

- `src/app/login/page.tsx`
  - 读取 `reset=success`，将一次性成功提示传递给登录表单或页面内展示。

- `src/middleware.ts`
  - 将 `/forgot-password`、`/reset-password` 纳入公开路径。
  - 保持 `/auth` 前缀公开，确保回调可执行。

### 新增

- `src/components/auth/ForgotPasswordForm.tsx`
  - 客户端邮箱输入和提交状态。
  - 使用 `loading` 防止重复请求。
  - 组件卸载后不再写入状态。
  - 提供返回登录链接。

- `src/app/forgot-password/page.tsx`
  - 使用与登录页一致的 SpiritGarden 双栏布局和页面元数据。
  - 渲染 `ForgotPasswordForm`，通过 `Suspense` 提供加载占位。

- `src/components/auth/ResetPasswordForm.tsx`
  - 检查恢复会话、输入新密码和确认密码。
  - 使用 `loading` 防止重复更新。
  - 订阅 `onAuthStateChange` 时在卸载时调用 `unsubscribe`。
  - 成功后执行 `signOut` 并跳转登录页，失败保留用户输入以便重试。

- `src/app/reset-password/page.tsx`
  - 使用登录页布局渲染 `ResetPasswordForm`。

- `src/app/auth/callback/route.ts`
  - 读取 `code` 和 `next` 查询参数。
  - 缺少 code 或 code 交换失败时跳转 `/forgot-password?error=invalid-link`。
  - 成功时跳转安全的 `next` 路径。

- `src/lib/auth/passwordReset.ts`
  - 保存公开的路径、查询参数和消息常量。
  - 提供邮箱格式校验和安全回调路径解析等纯函数，便于单元测试。

## 状态与错误处理

- 初始：展示邮箱或密码表单。
- 提交中：禁用提交按钮和相关输入，显示“发送中...”或“保存中...”。
- 发送成功：展示统一的邮箱提示，保留邮箱值，提供返回登录入口。
- 发送失败：展示通用错误“暂时无法发送重置邮件，请稍后重试”，不直接暴露 Supabase 原始错误。
- 回调失败：跳转到忘记密码页并显示无效或已过期链接提示。
- 无恢复会话：重置页显示“重置链接无效或已过期”，提供重新发送入口。
- 密码不一致：提交前在表单内提示，避免发起请求。
- 更新失败：展示通用错误并保留输入，允许再次提交。

## 并发、清理与安全

- 同一表单通过 `loading` 状态拒绝重复提交；异步请求完成后仅在组件仍挂载时更新状态。
- 不使用 Axios；Supabase Auth 当前客户端 API 不暴露可传入的 AbortSignal，因此以提交锁和卸载状态保护避免竞态写入。
- `onAuthStateChange` 返回的订阅在 `useEffect` cleanup 中取消。
- 不使用定时器或长连接；本需求不引入 SSE。
- 回调跳转使用现有 `isSafeNextPath` 规则，禁止外部 URL 和协议相对路径。
- 成功文案不区分邮箱是否存在，降低账号枚举风险。
- 密码只交给 Supabase Auth，不写入日志、URL、localStorage 或服务端代码。

## 测试与验收

### 单元测试

- 完整邮箱格式校验：合法邮箱通过，空值和明显非法格式拒绝。
- 回调路径解析：默认路径、安全站内路径通过，外部 URL 和协议相对路径回退默认路径。
- 重置表单：密码不一致不调用更新；请求失败可重试；成功后跳转登录。

### 页面验收

- `/login` 可进入 `/forgot-password`。
- 输入完整邮箱后只提交一次请求，成功提示不泄露账号存在性。
- 邮件回调可以进入 `/reset-password`；缺少或过期 code 有明确错误页面状态。
- 设置新密码成功后返回登录页，使用新密码可以重新登录。
- 直接访问三个公开路径不会被中间件重定向回 `/login`。
- `pnpm lint`、`pnpm typecheck`、相关单元测试和生产构建通过。

