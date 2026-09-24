# Story Camera Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Make each forest-valley story node drive a smooth camera move and an accessible region description panel, with a reliable return-to-panorama action.

**Architecture:** Keep camera state in `DioramaScene.tsx` beside the existing orbit controls. Extend the node data with camera targets and descriptions, interpolate toward a selected target in the render loop, and render the information panel as a React overlay so links and focus remain accessible. Dragging, wheel zoom, fallback rendering, and reduced-motion behavior remain intact.

**Tech Stack:** Next.js 16, React 19, Three.js, TypeScript, Vitest, ESLint.

## Global Constraints

- Preserve the existing node IDs and route links: `studio`, `herbs`, and `archive`.
- Preserve pointer orbit, wheel zoom, local GLB loading, WebGL fallback, and reduced-motion support.
- Use the existing Three.js camera/orbit state; do not add a camera-animation dependency.
- Keep the panel lightweight and avoid covering the hero title at the default viewport.
- Do not modify unrelated dirty-worktree files or commit changes.

### Task 1: Story node data and camera targets

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add a failing contract for node descriptions, camera targets, and a selected node state.
- [x] Run the focused test and verify the expected failure.
- [x] Extend the existing node data with `description`, `camera.theta`, `camera.phi`, `camera.radius`, and `camera.target` values for the three existing routes.
- [x] Add a typed `CameraTarget` shape and keep the node IDs/links unchanged.
- [x] Run the focused test and confirm it passes.

### Task 2: Smooth camera transitions

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add a failing contract for `cameraTarget`, interpolation, `Return to panorama`, and drag interruption.
- [x] Run the focused test and verify the expected failure.
- [x] Add `cameraTarget` and `cameraTransitionActive` state inside the WebGL effect; use `THREE.MathUtils.damp` for theta, phi, radius, and look target values.
- [x] Keep pointer drag and wheel handlers authoritative: pointer down or wheel clears the active transition target and returns control to the user.
- [x] In reduced-motion mode, snap to the target instead of damping.
- [x] Run the focused test and verify existing pointer/wheel contracts remain green.

### Task 3: Region description panel

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add a failing contract for `sg-diorama-story-panel`, region title/description copy, route CTA, and a return control.
- [x] Run the focused test and verify the expected failure.
- [x] Render the active node panel beside the canvas overlay with a close/return button and the existing route link.
- [x] Give the panel `aria-live="polite"`, a labelled section, and keyboard-safe focus behavior.
- [x] Add responsive CSS so the panel moves below the canvas content on narrow screens and does not cover the hero heading at default zoom.
- [x] Run the focused test and inspect the CSS contract.

### Task 4: Node activation and return-to-panorama behavior

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add a failing contract for node click/focus activation, `Escape` close, and the `返回全景` action.
- [x] Run the focused test and verify the expected failure.
- [x] Make click, keyboard focus, and panel CTA select the same active node and camera target.
- [x] Add a document-level `Escape` listener with cleanup that clears the active node and restores the default orbit target.
- [x] Make `返回全景` clear the panel and smoothly restore `{ theta: 0.35, phi: 1.12, radius: 7.2 }`.
- [x] Preserve reduced-motion behavior for both focus and return transitions.
- [x] Run the focused test and verify the interaction contracts.

## Verification Commands

```bash
pnpm vitest run src/components/home/landing/DioramaScene.test.ts src/components/home/landing/SpiritGardenHome.test.ts src/components/home/shell/SiteFooter.test.ts
pnpm exec eslint src/components/home/landing/DioramaScene.tsx src/components/home/landing/DioramaScene.test.ts
pnpm exec tsc --noEmit --pretty false
git diff --check
```

Repository-wide TypeScript baseline errors must be reported separately from any new `DioramaScene` errors.
