# 忘记密码实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 SpiritGarden 增加安全、可恢复、可测试的 Supabase 邮箱忘记密码流程。

**Architecture:** 使用客户端 Supabase Auth 发起重置邮件和更新密码，使用 App Router Route Handler 完成 PKCE code 交换。公开路由由 middleware 明确放行；纯函数集中处理邮箱校验、回调跳转和文案，组件只负责表单状态与页面交互。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Supabase JS/SSR、Vitest、Playwright。

## Global Constraints

- 只接受完整邮箱地址，不复用 `resolveLoginEmail` 的账号别名映射。
- 不新增 Axios；Supabase Auth 客户端 API 直接调用，使用提交锁防重复请求。
- 所有异步组件在卸载后不得写入状态；认证订阅必须在 cleanup 中取消。
- 回调只允许 `isSafeNextPath` 认可的站内路径，拒绝外部跳转。
- 不暴露邮箱是否存在，不把密码写入日志、URL、localStorage 或服务端代码。
- 使用现有 SpiritGarden 登录布局和 `sg-*` 样式 token，不引入新的 UI 库。
- 遵循仓库 ESLint、Prettier、TypeScript 和 Server/Client Component 边界。
- 保留当前工作树中的无关变更，不执行 reset、checkout 或清理命令。

---

### Task 1: 密码重置纯函数与测试

**Files:**
- Create: `src/lib/auth/passwordReset.ts`
- Create: `src/lib/auth/passwordReset.test.ts`

**Interfaces:**
- `isValidResetEmail(value: string): boolean`
- `resolveResetNextPath(value: string | null | undefined): string`
- `buildPasswordResetRedirect(origin: string): string`
- `PASSWORD_RESET_ROUTES`、`PASSWORD_RESET_MESSAGES` 常量对象及其推导类型。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildPasswordResetRedirect,
  isValidResetEmail,
  resolveResetNextPath,
} from '@/lib/auth/passwordReset'

describe('password reset helpers', () => {
  it('accepts a complete email and rejects blank or malformed values', () => {
    expect(isValidResetEmail('owner@example.com')).toBe(true)
    expect(isValidResetEmail(' owner@example.com ')).toBe(true)
    expect(isValidResetEmail('owner')).toBe(false)
    expect(isValidResetEmail('owner@')).toBe(false)
    expect(isValidResetEmail('')).toBe(false)
  })

  it('keeps safe reset paths and rejects external redirects', () => {
    expect(resolveResetNextPath('/reset-password')).toBe('/reset-password')
    expect(resolveResetNextPath('https://evil.example')).toBe('/reset-password')
    expect(resolveResetNextPath('//evil.example')).toBe('/reset-password')
    expect(resolveResetNextPath(null)).toBe('/reset-password')
  })

  it('builds a callback URL from the current origin', () => {
    expect(buildPasswordResetRedirect('https://app.example')).toBe(
      'https://app.example/auth/callback?next=%2Freset-password',
    )
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/lib/auth/passwordReset.test.ts`

Expected: FAIL because `src/lib/auth/passwordReset.ts` does not exist.

- [ ] **Step 3: 写最小实现**

实现要求：

```ts
export const PASSWORD_RESET_ROUTES = {
  forgot: '/forgot-password',
  reset: '/reset-password',
  callback: '/auth/callback',
} as const

export function isValidResetEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function resolveResetNextPath(value: string | null | undefined): string {
  return isSafeNextPath(value) ? value : PASSWORD_RESET_ROUTES.reset
}

export function buildPasswordResetRedirect(origin: string): string {
  return `${origin}${PASSWORD_RESET_ROUTES.callback}?next=${encodeURIComponent(PASSWORD_RESET_ROUTES.reset)}`
}
```

导出统一中文文案常量，组件不得重复定义同一文案。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/lib/auth/passwordReset.test.ts`

Expected: 3 tests pass with exit code 0。

- [ ] **Step 5: 运行格式和类型检查**

Run: `pnpm eslint src/lib/auth/passwordReset.ts src/lib/auth/passwordReset.test.ts && pnpm tsc --noEmit`

Expected: no lint or TypeScript errors。

### Task 2: PKCE 回调和公开路由边界

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/callback/route.test.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- `GET(request: Request): Promise<Response>`：读取 `code`、`next`，交换会话并返回站内重定向。
- 依赖 `createClient()`、`resolveResetNextPath()` 和 `NextResponse.redirect()`。

- [ ] **Step 1: 写失败的 Route Handler 测试**

测试场景：

```ts
it('exchanges a valid code and redirects to the safe reset path', async () => {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null })
  vi.mocked(createClient).mockResolvedValue({
    auth: { exchangeCodeForSession },
  } as Awaited<ReturnType<typeof createClient>>)

  const response = await GET(
    new Request('http://localhost:3000/auth/callback?code=abc&next=/reset-password'),
  )

  expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
  expect(response.headers.get('location')).toBe('http://localhost:3000/reset-password')
})

it('redirects invalid callbacks back to forgot password', async () => {
  const response = await GET(new Request('http://localhost:3000/auth/callback'))
  expect(response.headers.get('location')).toContain('/forgot-password?error=invalid-link')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/app/auth/callback/route.test.ts`

Expected: FAIL because the route module and handler are missing。

- [ ] **Step 3: 实现 Route Handler 并更新 middleware**

实现约束：

- 缺少 `code` 时直接跳转 `/forgot-password?error=invalid-link`。
- `exchangeCodeForSession` 返回错误时也跳转同一错误地址，不把 Supabase 错误放进 URL。
- 成功后使用 `resolveResetNextPath(next)`，默认 `/reset-password`。
- `PUBLIC_PREFIXES` 增加 `/forgot-password` 和 `/reset-password`；保留 `/auth` 前缀公开。

- [ ] **Step 4: 运行回调测试确认通过**

Run: `pnpm vitest run src/app/auth/callback/route.test.ts src/lib/auth/passwordReset.test.ts`

Expected: all tests pass。

- [ ] **Step 5: 检查公开路由规则**

Run: `pnpm eslint src/app/auth/callback/route.ts src/app/auth/callback/route.test.ts src/middleware.ts && pnpm tsc --noEmit`

Expected: no lint or TypeScript errors。

### Task 3: 忘记密码表单、登录入口和页面

**Files:**
- Create: `src/components/auth/ForgotPasswordForm.tsx`
- Create: `src/app/forgot-password/page.tsx`
- Modify: `src/components/auth/LoginForm.tsx`
- Modify: `src/app/globals.css`
- Create: `e2e/password-reset.spec.ts`

**Interfaces:**
- `ForgotPasswordForm` 无外部 props；内部维护 `email`、`loading`、`sent`、`error` 状态。
- 发送调用 `supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })`。

- [ ] **Step 1: 写页面验收测试**

```ts
test('login page exposes a forgot-password link', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('link', { name: '忘记密码' })).toHaveAttribute(
    'href',
    '/forgot-password',
  )
})

test('forgot-password page is public and validates complete email', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.getByRole('heading', { name: '忘记密码' })).toBeVisible()
  await page.getByRole('button', { name: '发送重置邮件' }).click()
  await expect(page.getByRole('alert')).toContainText('请输入完整邮箱地址')
})
```

- [ ] **Step 2: 运行 E2E 确认失败**

Run: `pnpm exec playwright test e2e/password-reset.spec.ts --project=chromium`

Expected: FAIL because the link, page and form do not exist。

- [ ] **Step 3: 实现表单和页面**

实现要求：

- 页面沿用 `src/app/login/page.tsx` 的品牌布局和图片资源。
- 表单只接受完整邮箱；格式错误不发请求。
- 提交期间禁用邮箱输入和按钮，按钮文案为“发送中...”。
- 成功提示固定为“如果该邮箱已注册，重置链接将发送到邮箱”。
- 失败提示固定为“暂时无法发送重置邮件，请稍后重试”。
- 使用 `let mounted = true` 和 cleanup，异步完成后仅在挂载状态下更新 React state。
- 通过普通 `<a>` 或 `Link` 提供“返回登录”入口，补充 `aria-live`/`role="alert"`。
- 在 `LoginForm` 密码字段下方加入“忘记密码”链接，不改变原有登录提交逻辑。
- 增加表单页面所需的最小 `sg-login-form__link`、成功状态和错误状态样式，全部使用现有 CSS 变量。

- [ ] **Step 4: 运行 E2E 确认通过**

Run: `pnpm exec playwright test e2e/password-reset.spec.ts --project=chromium`

Expected: login link和公开忘记密码页面测试通过。

- [ ] **Step 5: 检查静态质量**

Run: `pnpm eslint src/components/auth/ForgotPasswordForm.tsx src/app/forgot-password/page.tsx src/components/auth/LoginForm.tsx e2e/password-reset.spec.ts && pnpm tsc --noEmit`

Expected: no lint or TypeScript errors。

### Task 4: 重置密码表单和恢复会话状态

**Files:**
- Create: `src/components/auth/ResetPasswordForm.tsx`
- Create: `src/app/reset-password/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `e2e/password-reset.spec.ts`

**Interfaces:**
- `ResetPasswordForm` 无外部 props；内部维护 `newPassword`、`confirmPassword`、`loading`、`ready`、`error`、`updated` 状态。
- 使用 `supabase.auth.getSession()` 检查恢复会话，并用 `onAuthStateChange` 订阅 `PASSWORD_RECOVERY`。

- [ ] **Step 1: 扩展失败验收测试**

```ts
test('reset-password page is public and exposes password confirmation fields', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible()
  await expect(page.getByLabel('新密码')).toBeVisible()
  await expect(page.getByLabel('确认新密码')).toBeVisible()
})

test('invalid auth callback exposes a recoverable error', async ({ page }) => {
  await page.goto('/auth/callback')
  await expect(page).toHaveURL(/\/forgot-password\?error=invalid-link/)
  await expect(page.getByRole('alert')).toContainText('链接无效或已过期')
})
```

- [ ] **Step 2: 运行 E2E 确认失败**

Run: `pnpm exec playwright test e2e/password-reset.spec.ts --project=chromium`

Expected: FAIL because reset page and callback error UI do not exist。

- [ ] **Step 3: 实现恢复表单和页面状态**

实现要求：

- 页面公开可访问，但没有恢复会话时显示“重置链接无效或已过期”，并提供 `/forgot-password` 链接。
- 新密码和确认密码均为 `type="password"`，使用 `autoComplete="new-password"`。
- 两次输入不一致时只显示前端错误，不调用 `updateUser`。
- 更新期间锁定两个输入和按钮，按钮文案为“保存中...”。
- `onAuthStateChange` 的 subscription 在 cleanup 中调用 `unsubscribe`；异步 `getSession` 使用 mounted guard。
- `updateUser` 失败显示通用错误并保留输入；成功后 `signOut()`，跳转 `/login?reset=success`。
- 登录页读取 `reset=success`，展示一次性成功提示“密码已更新，请使用新密码登录”。

- [ ] **Step 4: 运行 E2E 确认通过**

Run: `pnpm exec playwright test e2e/password-reset.spec.ts --project=chromium`

Expected: all public route, invalid callback and reset form tests pass。

- [ ] **Step 5: 检查静态质量**

Run: `pnpm eslint src/components/auth/ResetPasswordForm.tsx src/app/reset-password/page.tsx src/app/login/page.tsx src/app/globals.css e2e/password-reset.spec.ts && pnpm tsc --noEmit`

Expected: no lint or TypeScript errors。

### Task 5: 全量验证与 Code Review 自检

**Files:**
- Modify only files from Tasks 1–4 if verification exposes a feature-specific defect.

- [ ] **Step 1: 运行相关单元测试**

Run: `pnpm test:unit -- src/lib/auth/passwordReset.test.ts src/app/auth/callback/route.test.ts`

Expected: all targeted tests pass。

- [ ] **Step 2: 运行全量静态检查**

Run: `pnpm lint && pnpm typecheck`

Expected: exit code 0；若出现既有基线错误，记录文件、行号和与本次变更的关系，不扩大修复范围。

- [ ] **Step 3: 运行页面测试**

Run: `pnpm exec playwright test e2e/password-reset.spec.ts --project=chromium`

Expected: password reset public-route and interaction checks pass。

- [ ] **Step 4: 运行生产构建**

Run: `pnpm build`

Expected: Next.js production build exits 0。

- [ ] **Step 5: 执行 Code Review 自检**

逐项确认：

- 所有公开路径均未绕过 `isSafeNextPath`。
- 成功提示不泄露邮箱是否存在，Supabase 原始错误未直接展示。
- 请求期间无法重复提交，组件卸载后无状态写入。
- 认证订阅已取消，页面无未清理定时器或长连接。
- 密码不进入日志、URL、localStorage 或服务端输出。
- 登录页现有账号解析、角色跳转和错误文案未被破坏。
- `git diff --check` 通过，且只包含本需求相关文件。

