# Login Page 3D Garden Entrance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split login layout with a reusable 3D garden authentication shell that supports desktop collapsible panels, mobile floating panels, and the existing auth flows.

**Architecture:** Keep authentication in the existing form components and move shared visual behavior into a client `AuthGardenShell`. Extend `DioramaScene` with a small auth-page configuration that hides story navigation while preserving its orbit camera, drag, zoom, animation, and WebGL fallback. Update the three auth routes to compose the shell around their existing Suspense form content.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Three.js 0.186, CSS tokens in `src/app/globals.css`, Vitest, Playwright.

## Global Constraints

- Preserve existing Supabase authentication, account alias resolution, `next` handling, role redirect, and password reset behavior.
- Reuse the existing SpiritGarden Three.js scene and static `hero-landscape.png` fallback.
- Keep authentication pages usable without WebGL, drag gestures, or animation.
- Use `sg-*` classes and existing CSS variables; do not add a separate login color system.
- Keep client boundaries minimal and clean up browser resources in effects.
- Preserve existing user changes and do not commit, push, deploy, or remove unrelated files.

## File Map

**Create**

- `src/components/auth/AuthGardenShell.tsx`: Client shell for the full-screen scene, panel state, responsive placement, and accessible collapse controls.
- `src/components/auth/AuthGardenShell.test.ts`: Source contract tests for panel controls and route composition assumptions.

**Modify**

- `src/components/home/landing/DioramaScene.tsx`: Add an optional `showStoryNodes` prop and skip auth-page story node rendering when false.
- `src/app/login/page.tsx`: Compose `LoginForm` inside `AuthGardenShell` and keep the existing Suspense fallback.
- `src/app/forgot-password/page.tsx`: Compose `ForgotPasswordForm` inside `AuthGardenShell` and keep the existing Suspense fallback.
- `src/app/reset-password/page.tsx`: Compose `ResetPasswordForm` inside `AuthGardenShell` and keep the existing Suspense fallback.
- `src/app/globals.css`: Replace the old split login layout rules with the 3D shell, panel, collapse button, scene branding, responsive mobile layout, focus states, fallback, and reduced-motion rules.
- `src/components/home/landing/DioramaScene.test.ts`: Extend scene source contracts for the auth configuration and fallback behavior.

## Task 1: Make `DioramaScene` configurable for authentication pages

**Files:**

- Modify: `src/components/home/landing/DioramaScene.tsx:9,645-980`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**

- Consumes: existing `fallbackSrc` prop and homepage behavior.
- Produces: `DioramaSceneProps = { fallbackSrc: string; showStoryNodes?: boolean }`, with `showStoryNodes` defaulting to `true` so the homepage remains unchanged.

- [ ] **Step 1: Add the failing source contract tests**

Add assertions that the source exposes an optional `showStoryNodes` prop, defaults it to `true`, and conditionally renders the story-node overlay.

```ts
it('keeps homepage story nodes enabled by default', () => {
  expect(sceneSource).toContain('showStoryNodes?: boolean')
  expect(sceneSource).toContain('showStoryNodes = true')
})

it('allows auth pages to hide story navigation', () => {
  expect(sceneSource).toContain('showStoryNodes &&')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run src/components/home/landing/DioramaScene.test.ts`

Expected: FAIL because the prop and conditional rendering do not exist yet.

- [ ] **Step 3: Implement the minimal prop change**

Change the prop interface and component signature to:

```tsx
interface DioramaSceneProps {
  fallbackSrc: string
  showStoryNodes?: boolean
}

export function DioramaScene({
  fallbackSrc,
  showStoryNodes = true,
}: DioramaSceneProps) {
```

Wrap only the story-node overlay and story panel in `showStoryNodes && (...)`. Leave the canvas, orbit handlers, wheel zoom, keyboard escape behavior, and fallback path unchanged.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `pnpm vitest run src/components/home/landing/DioramaScene.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS, or only pre-existing errors unrelated to this change.

## Task 2: Add the reusable authentication garden shell

**Files:**

- Create: `src/components/auth/AuthGardenShell.tsx`
- Create: `src/components/auth/AuthGardenShell.test.ts`

**Interfaces:**

- Consumes: `children: React.ReactNode`, an existing auth form; `DioramaScene` with `showStoryNodes={false}`.
- Produces: named export `AuthGardenShell({ children }: AuthGardenShellProps)` with an accessible panel toggle and a stable `sg-auth-garden` DOM structure.

- [ ] **Step 1: Add failing source contract tests**

Use the repository's existing source-contract test style:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const shellSource = readFileSync('src/components/auth/AuthGardenShell.tsx', 'utf8')

describe('AuthGardenShell', () => {
  it('exposes a collapsible accessible panel', () => {
    expect(shellSource).toContain('aria-expanded')
    expect(shellSource).toContain('aria-controls="auth-garden-panel"')
    expect(shellSource).toContain('showStoryNodes={false}')
  })

  it('keeps the form outside the scene gesture surface', () => {
    expect(shellSource).toContain('sg-auth-garden__panel')
    expect(shellSource).toContain('sg-auth-garden__canvas-tools')
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run src/components/auth/AuthGardenShell.test.ts`

Expected: FAIL because the shell file does not exist.

- [ ] **Step 3: Implement the client shell**

Create a `'use client'` component with this behavior:

```tsx
interface AuthGardenShellProps {
  children: React.ReactNode
}

export function AuthGardenShell({ children }: AuthGardenShellProps) {
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className={`sg-auth-garden${panelOpen ? '' : ' sg-auth-garden--exploring'}`}>
      <div className="sg-auth-garden__scene" aria-hidden={panelOpen ? undefined : undefined}>
        <DioramaScene fallbackSrc="/spirit-garden/hero-landscape.png" showStoryNodes={false} />
      </div>
      <div className="sg-auth-garden__brand" aria-label="SpiritGarden">
        <Image ... />
        <span>SpiritGarden</span>
        <small>园主的数字庭院</small>
        <p>走进庭院，继续你的故事。</p>
      </div>
      <button
        type="button"
        className="sg-auth-garden__explore-toggle"
        aria-controls="auth-garden-panel"
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((current) => !current)}
      >
        {panelOpen ? '收起登录面板' : '返回登录'}
      </button>
      <main id="auth-garden-panel" className="sg-auth-garden__panel" aria-hidden={!panelOpen}>
        <div className="sg-auth-garden__panel-inner">{children}</div>
      </main>
    </div>
  )
}
```

Use a small logo `Image`, preserve the current `hero-landscape.png` fallback, and ensure the scene canvas receives the drag area only where the panel does not overlap. When the panel is closed, apply `inert` or an equivalent non-focusable state to the panel content so hidden inputs cannot receive keyboard focus.

- [ ] **Step 4: Run the focused test**

Run: `pnpm vitest run src/components/auth/AuthGardenShell.test.ts`

Expected: PASS.

## Task 3: Compose all authentication routes with the shell

**Files:**

- Modify: `src/app/login/page.tsx`
- Modify: `src/app/forgot-password/page.tsx`
- Modify: `src/app/reset-password/page.tsx`

**Interfaces:**

- Consumes: `AuthGardenShell` and the existing form components.
- Produces: identical auth form behavior inside the new shell for all three routes.

- [ ] **Step 1: Add route composition assertions**

Extend or create source tests that verify all three pages import and render `AuthGardenShell`, preserve their existing form import, and retain their Suspense fallback.

```ts
for (const pagePath of ['src/app/login/page.tsx', 'src/app/forgot-password/page.tsx', 'src/app/reset-password/page.tsx']) {
  const source = readFileSync(pagePath, 'utf8')
  expect(source).toContain("@/components/auth/AuthGardenShell")
  expect(source).toContain('<AuthGardenShell>')
  expect(source).toContain('<Suspense')
}
```

- [ ] **Step 2: Run the route contract tests and verify the new assertions fail**

Run: `pnpm vitest run src/components/auth/AuthGardenShell.test.ts`

Expected: FAIL until the three pages are composed with the shell.

- [ ] **Step 3: Replace duplicated split-layout markup**

In each page, remove the `next/image` import and old `sg-login` brand/panel markup. Keep metadata, the page-specific Suspense fallback, and form import. Render the form as:

```tsx
return (
  <AuthGardenShell>
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  </AuthGardenShell>
)
```

Use the corresponding form and fallback names for the other two routes.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm vitest run src/components/auth/AuthGardenShell.test.ts src/components/home/landing/DioramaScene.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS, or only pre-existing errors unrelated to this change.

## Task 4: Replace login CSS with responsive 3D shell styles

**Files:**

- Modify: `src/app/globals.css:5560-5782`

**Interfaces:**

- Consumes: the class names emitted by `AuthGardenShell` and existing `sg-login-form`, `sg-form-*`, and `sg-btn` classes.
- Produces: desktop right floating panel, mobile floating panel, collapse animation, focus states, fallback visibility, and reduced-motion behavior.

- [ ] **Step 1: Add source style contracts**

Add assertions to the shell test for required selectors in `globals.css`:

```ts
const styles = readFileSync('src/app/globals.css', 'utf8')
expect(styles).toContain('.sg-auth-garden')
expect(styles).toContain('.sg-auth-garden--exploring')
expect(styles).toContain('@media (max-width: 767px)')
expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
```

- [ ] **Step 2: Run the style contract and verify it fails**

Run: `pnpm vitest run src/components/auth/AuthGardenShell.test.ts`

Expected: FAIL because the new selectors do not exist.

- [ ] **Step 3: Implement the scoped styles**

Replace only the old `.sg-login*` block with styles that:

- Set `.sg-auth-garden` to `position: relative; min-height: 100dvh; overflow: hidden; background: var(--sg-cream);`.
- Make `.sg-auth-garden__scene`, `.sg-diorama`, and the static fallback fill the viewport.
- Place `.sg-auth-garden__brand` at the upper-left with an overlay readable over the sky.
- Place `.sg-auth-garden__panel` as a right-side translucent panel on desktop and a floating card on mobile.
- Let `.sg-auth-garden--exploring .sg-auth-garden__panel` move out of view while the return button remains visible.
- Set `pointer-events: none` on decorative brand content and `pointer-events: auto` on controls and panel.
- Add `:focus-visible` outlines using existing SpiritGarden variables.
- Use `env(safe-area-inset-*)`, `dvh`, and `visualViewport`-compatible CSS sizing for mobile keyboard safety.
- Disable panel and scene transitions under `prefers-reduced-motion: reduce`.

Do not add hex colors; use existing `--sg-*` tokens and `color-mix` where needed.

- [ ] **Step 4: Run lint and style-related tests**

Run: `pnpm lint`

Expected: PASS, with no new warnings in the changed files.

Run: `pnpm vitest run src/components/auth/AuthGardenShell.test.ts`

Expected: PASS.

## Task 5: Verify behavior in browser and run project gates

**Files:**

- Modify only if verification reveals a defect: the files from Tasks 1-4.

- [ ] **Step 1: Start the app using the existing local dev command**

Run: `pnpm dev`

Expected: the Next.js app serves `/login?next=%2F` without compilation errors.

- [ ] **Step 2: Check the desktop login flow in the current browser**

Verify visually and interactively:

1. The 3D garden and right floating form appear together.
2. Dragging the canvas rotates the garden and scrolling over it zooms within limits.
3. Clicking the collapse control hides the panel and leaves a visible “返回登录” control.
4. Clicking “返回登录” restores the form without resetting the camera.
5. Dragging over form fields does not rotate the garden.
6. Invalid credentials show the existing inline error.
7. “忘记密码” still navigates to `/forgot-password`.

- [ ] **Step 3: Check mobile viewport behavior**

Use a narrow viewport and verify:

1. The login card floats over the scene without horizontal overflow.
2. Focused inputs and the submit button remain visible when the keyboard changes viewport height.
3. Closing the card leaves enough scene area for touch rotation and pinch zoom.
4. The return control is reachable by keyboard and touch.

- [ ] **Step 4: Verify fallback and reduced motion**

Use a browser with WebGL disabled or force the existing renderer failure path; verify the static `hero-landscape.png` background still exposes the form. Emulate `prefers-reduced-motion: reduce` and verify no required transition or continuous motion blocks login.

- [ ] **Step 5: Run project gates**

Run:

```bash
pnpm vitest run src/components/auth/AuthGardenShell.test.ts src/components/home/landing/DioramaScene.test.ts
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all focused tests, lint, typecheck, and build pass. Record any pre-existing failure separately from regressions introduced by this change.
