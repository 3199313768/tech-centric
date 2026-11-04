# Login Page 3D Detail Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the existing 3D garden login entrance with environmental depth, a more tactile login panel, and discoverable exploration controls while preserving authentication behavior.

**Architecture:** Keep Three.js scene responsibilities inside `DioramaScene`; add an authentication-only detail mode and small camera status callbacks without moving auth logic into the scene. Keep branding, panel state, helper prompts, reset controls, and responsive UI in `AuthGardenShell`; keep form behavior in the existing auth forms.

**Tech Stack:** Next.js 16 App Router, React 19, Three.js, CSS tokens in `src/app/globals.css`, Vitest, direct local binaries for verification.

## Global Constraints

- Preserve Supabase authentication, `next` handling, role redirects, and password reset behavior.
- Reuse existing garden assets and `DioramaScene`; do not add a new login color system or server endpoint.
- Keep WebGL/static fallback, keyboard access, reduced-motion behavior, and mobile layout usable.
- Use existing `sg-*` classes and CSS variables; do not add hex colors to CSS.
- Do not commit, push, deploy, delete, or overwrite unrelated workspace changes.

## File Map

- Modify `src/components/home/landing/DioramaScene.tsx`: add auth detail mode, bounded ambient effects, camera reset/status callbacks, and reduced-motion-safe animation.
- Modify `src/components/home/landing/DioramaScene.test.ts`: add source contracts for auth detail mode and camera controls.
- Modify `src/components/auth/AuthGardenShell.tsx`: add panel metadata, password form affordance container hooks, exploration prompt, compass/reset controls, and scene status wiring.
- Modify `src/components/auth/AuthGardenShell.test.ts`: cover the shell structure and new controls.
- Modify `src/components/auth/LoginForm.tsx`: add password visibility state, field icons, and semantic button labels without changing submit logic.
- Modify `src/app/globals.css`: add scene atmosphere overlays, panel texture/status styles, control styling, prompt transitions, and responsive rules.
- Modify `src/app/login/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` only if shared shell content requires a route-level class or metadata hook.

### Task 1: Add bounded scene detail and camera status interfaces

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**
- Consume existing `fallbackSrc` and `showStoryNodes` props.
- Produce optional props `authMode?: boolean`, `onCameraStateChange?: (state: { theta: number; phi: number; radius: number }) => void`, and `resetCameraKey?: number`.

- [ ] **Step 1: Add failing source contracts**

```ts
it('supports authentication scene detail and camera status callbacks', () => {
  expect(sceneSource).toContain('authMode?: boolean')
  expect(sceneSource).toContain('onCameraStateChange')
  expect(sceneSource).toContain('resetCameraKey?: number')
})
```

- [ ] **Step 2: Run the focused test and verify the new contract fails**

Run `./node_modules/.bin/vitest run src/components/home/landing/DioramaScene.test.ts`.

- [ ] **Step 3: Implement the smallest interface and effect changes**

Add the optional props with defaults that preserve homepage behavior. Invoke `onCameraStateChange` after drag, wheel, touch, and reset updates. When `resetCameraKey` changes, restore `DEFAULT_CAMERA_TARGET`. Gate the added ambient animation and camera inertia behind `authMode` and `prefers-reduced-motion`; do not change the existing story-node path.

- [ ] **Step 4: Run focused tests and lint**

Run `./node_modules/.bin/vitest run src/components/home/landing/DioramaScene.test.ts` and `./node_modules/.bin/eslint src/components/home/landing/DioramaScene.tsx src/components/home/landing/DioramaScene.test.ts`.

### Task 2: Add visual environment details to the auth scene

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**
- Consume `authMode` and the existing garden group.
- Produce bounded firefly, mist, cabin-window glow, and stream-highlight layers that are disposed with the scene.

- [ ] **Step 1: Add source contracts for bounded auth details**

```ts
it('includes bounded ambient layers for auth mode', () => {
  expect(sceneSource).toContain('auth-fireflies')
  expect(sceneSource).toContain('auth-mist')
  expect(sceneSource).toContain('auth-window-glow')
  expect(sceneSource).toContain('prefers-reduced-motion')
})
```

- [ ] **Step 2: Implement low-cost layers**

Create a small fixed particle pool, two translucent mist planes, a warm emissive window mesh, and a narrow stream highlight mesh. Update only their transforms/opacity in the existing animation loop. Keep particle count capped, use `depthWrite: false` for translucent overlays, and add every created geometry/material/texture to the existing cleanup collection.

- [ ] **Step 3: Run focused tests and inspect the browser**

Run the focused Vitest file, then inspect `/login?next=%2F` in the existing local browser. Verify the scene still renders, the cabin remains visible, and no overlay blocks pointer input.

### Task 3: Enrich the authentication shell and exploration controls

**Files:**
- Modify: `src/components/auth/AuthGardenShell.tsx`
- Test: `src/components/auth/AuthGardenShell.test.ts`

**Interfaces:**
- Consume `DioramaScene` camera status callbacks.
- Produce `panelOpen`, `resetCameraKey`, `showExploreHint`, and compass/zoom status UI with accessible controls.

- [ ] **Step 1: Add failing shell contracts**

```ts
it('exposes exploration feedback controls', () => {
  expect(shellSource).toContain('回到主屋')
  expect(shellSource).toContain('拖动探索庭院')
  expect(shellSource).toContain('aria-label="当前视角方向"')
  expect(shellSource).toContain('authMode')
})
```

- [ ] **Step 2: Implement shell state and structure**

Pass `authMode` and camera callbacks to the scene. Add a reset button that increments `resetCameraKey`, a compass element that rotates from `theta`, a zoom label that appears during wheel/pinch updates, and a one-time exploration hint that respects reduced motion. Keep the panel `inert` while closed and keep controls outside the scene gesture surface.

- [ ] **Step 3: Run focused tests**

Run `./node_modules/.bin/vitest run src/components/auth/AuthGardenShell.test.ts src/components/home/landing/DioramaScene.test.ts`.

### Task 4: Add panel affordances and login form detail

**Files:**
- Modify: `src/components/auth/LoginForm.tsx`
- Modify: `src/components/auth/AuthGardenShell.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Preserve all existing form submission and error paths.
- Produce visual status elements, password visibility toggle, field icon affordances, and panel footer copy.

- [ ] **Step 1: Add focused source assertions**

```ts
expect(loginSource).toContain('type="button"')
expect(loginSource).toContain('aria-label="显示密码"')
expect(shellSource).toContain('园主入口')
expect(shellSource).toContain('安全入口')
```

- [ ] **Step 2: Implement form-only state changes**

Add `showPassword` state and switch the password input between `password` and `text`. Add an accessible icon button that updates its label to `隐藏密码`. Keep `handleLogin` unchanged. Add panel identity/status markup in the shell, not in the auth request components.

- [ ] **Step 3: Implement token-based styles**

Add panel paper texture, status badge, field focus glow, icon button, submit feedback, compass, reset button, hint, zoom readout, mist overlay, and mobile floating-panel rules using existing `--sg-*` variables and `color-mix`. Add reduced-motion overrides for every new transition.

- [ ] **Step 4: Run lint and focused tests**

Run `./node_modules/.bin/eslint src/components/auth/AuthGardenShell.tsx src/components/auth/AuthGardenShell.test.ts src/components/auth/LoginForm.tsx src/components/home/landing/DioramaScene.tsx src/components/home/landing/DioramaScene.test.ts src/app/login/page.tsx src/app/forgot-password/page.tsx src/app/reset-password/page.tsx` and the focused Vitest command.

### Task 5: Verify desktop, mobile CSS contracts, and regression boundaries

**Files:**
- Test: existing focused tests and browser page

- [ ] **Step 1: Run all focused tests and `git diff --check`**

Run `./node_modules/.bin/vitest run src/components/auth/AuthGardenShell.test.ts src/components/home/landing/DioramaScene.test.ts` and `git diff --check`.

- [ ] **Step 2: Verify the real login page**

In the existing local browser, verify initial scene, drag rotation, wheel/pinch zoom, reset, hint dismissal, panel close/reopen, password visibility, and form focus. Do not submit credentials.

- [ ] **Step 3: Run project checks with known environment limits**

Run `./node_modules/.bin/tsc --noEmit`, the changed-file ESLint command, and `./node_modules/.bin/next build --webpack`. Record pre-existing type errors and external font/network failures separately from regressions.

- [ ] **Step 4: Review final diff**

Run `git status --short` and `git diff --stat`; leave unrelated user files untouched and do not commit or push.
