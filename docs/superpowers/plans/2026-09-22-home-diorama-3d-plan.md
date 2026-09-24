# Home Diorama 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the homepage's flat hero image with a lightweight interactive 3D diorama garden that supports mouse and touch orbit/zoom while preserving the existing hero copy and a static fallback.

**Architecture:** Add a client-only `DioramaScene` canvas component using the browser's WebGL API and procedural low-poly geometry, loaded dynamically from the homepage. Keep the current image as an error/no-WebGL fallback and keep all text/actions in the existing DOM layer above the canvas.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, WebGL, Vitest.

## Global Constraints

- Preserve existing homepage copy, routes, navigation, and footer.
- Keep all WebGL code client-only and avoid secrets or network-loaded assets.
- Support pointer drag orbit, wheel zoom, and touch pinch zoom without automatic rotation.
- Render a usable static fallback when WebGL is unavailable or initialization fails.
- Keep styling in existing SpiritGarden tokens and avoid unrelated refactors.

### Task 1: Add the procedural diorama canvas

**Files:**
- Create: `src/components/home/landing/DioramaScene.tsx`
- Create: `src/components/home/landing/DioramaScene.test.ts`

- [ ] Write a source-level regression test for client-only canvas output, fallback text, and the no-auto-rotation contract.
- [ ] Run the focused test and verify it fails because the component does not exist.
- [ ] Implement a client component with a canvas ref, WebGL initialization, procedural low-poly garden geometry, pointer orbit, wheel zoom, touch pinch zoom, resize handling, and cleanup.
- [ ] Render an accessible fallback element when WebGL setup fails.
- [ ] Run the focused test and verify it passes.

### Task 2: Integrate the scene into the homepage

**Files:**
- Modify: `src/components/home/landing/SpiritGardenHome.tsx`
- Modify: `src/app/globals.css`

- [ ] Write a regression assertion that the homepage renders the diorama scene and preserves the hero content layer.
- [ ] Run the focused test and verify it fails before integration.
- [ ] Replace the image backdrop with `DioramaScene`, retaining the existing visual fallback image through the component props.
- [ ] Add responsive canvas layering, touch-action behavior, and fallback styling without changing hero copy or buttons.
- [ ] Run focused homepage tests and verify they pass.

### Task 3: Verify the page contract

**Files:**
- No additional files.

- [ ] Run `git diff --check`.
- [ ] Run the focused Vitest files for the scene and homepage.
- [ ] Run `pnpm typecheck`.
- [ ] Use the running local server to confirm the homepage still responds and redirects according to its existing auth behavior.
