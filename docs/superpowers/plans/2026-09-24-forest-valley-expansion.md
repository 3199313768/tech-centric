# Forest Valley Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Turn the procedural mountain cluster into a readable forest valley with continuous terrain, clear foreground/midground/background composition, ecological tree distribution, grounded materials and shadows, and story-node interactions that guide exploration.

**Architecture:** Keep the existing client-side Three.js scene in `DioramaScene.tsx` and extend its named groups and animation loop. Use deterministic procedural geometry and the existing local GLB assets; do not add remote model dependencies. Keep UI story nodes in the existing React overlay so navigation remains accessible and the WebGL canvas remains presentation-only.

**Tech Stack:** Next.js 16, React 19, Three.js, TypeScript, Vitest, ESLint.

## Global Constraints

- Preserve the current cabin, stream, path, sky, cloud, pointer orbit, wheel zoom, fallback image, and route links.
- Use local resources only; no remote model or texture downloads.
- Keep the existing `DioramaScene.tsx` ownership boundary and add source-contract tests in `DioramaScene.test.ts`.
- Use deterministic coordinates and seeded geometry so screenshots and tests remain stable.
- Do not commit or alter unrelated dirty-worktree files.
- Keep the fallback path functional when WebGL or local GLB loading is unavailable.

### Task 1: Continuous valley terrain

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**
- `createValleyTerrainGeometry(points: THREE.Vector3[], widths: number[], shoulderHeight: number)` returns a `THREE.BufferGeometry` for a shallow raised valley floor with sloped shoulders.
- The garden exposes named groups `forest-valley`, `mountain-ridge`, and `mountain-slope-layer`.

- [x] Write a failing source-contract test for `createValleyTerrainGeometry`, `forest-valley-shoulder`, and a valley floor that receives shadows.
- [x] Run `pnpm vitest run src/components/home/landing/DioramaScene.test.ts` and confirm the new contract fails.
- [x] Implement the valley geometry by extending the existing ribbon path with parallel shoulder vertices; place it below the cabin and stream so the stream remains the low point.
- [x] Add two deterministic shoulder meshes with muted green/rock materials and `receiveShadow = true`.
- [x] Run the focused test and confirm it passes.

### Task 2: Three-layer spatial composition

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**
- Named groups `valley-foreground`, `valley-midground`, and `valley-background` organize objects without changing route or node IDs.
- The render loop applies subtle, separate sway/parallax values to foreground and background foliage.

- [x] Add a failing contract for the three named composition groups and distinct fog/material treatment.
- [x] Run the focused test and verify the expected failure.
- [x] Move or clone only existing local rocks, trees, slope layers, and clouds into the composition groups; keep the main cabin in midground.
- [x] Apply stronger fog/low-contrast material to background ridge meshes and preserve crisp cabin/stream materials in midground.
- [x] Add restrained group animation that does not auto-rotate the camera.
- [x] Run the focused test and inspect for unchanged pointer and wheel contracts.

### Task 3: Ecological tree distribution

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**
- `addMountainTree` remains the procedural fallback helper.
- Authored Kenney tree placements cover the same deterministic mountain-forest points when GLBs load.
- Trees use `mountain-forest`, `forest-understory`, and `forest-tree` names for targeted animation/disposal.

- [x] Add a failing contract for `forest-understory`, `forest-tree`, and seeded variation in scale/rotation.
- [x] Run the focused test and verify the expected failure.
- [x] Add small understory meshes near the stream and tree bases, with no new external assets.
- [x] Apply deterministic scale/rotation variation and keep the densest trees on mountain shoulders, leaving the cabin sightline open.
- [x] Extend authored-tree placements only where they mirror the fallback forest points.
- [x] Run the focused test and confirm local GLB failure still leaves the procedural forest visible.

### Task 4: Grounded materials and contact shadows

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**
- `createGroundContactMaterial(baseColor: number, roughness: number, map?: THREE.Texture)` returns a `THREE.MeshStandardMaterial` with AO and non-metallic settings.
- Every terrain/tree/rock group uses `castShadow` and/or `receiveShadow` intentionally.

- [x] Add a failing contract for AO intensity, contact material creation, and ground-contact shadow settings.
- [x] Run the focused test and verify the expected failure.
- [x] Add subtle AO/roughness variation to valley shoulders, rock bases, and tree roots without replacing existing cabin PBR maps.
- [x] Tune shadow bias/normal bias and light intensity only if needed to keep the valley readable without shadow acne.
- [x] Run focused tests, ESLint, and the targeted TypeScript check.

### Task 5: Story-node interaction

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/home/landing/DioramaScene.test.ts`

**Interfaces:**
- Existing node IDs and links remain unchanged.
- Node visibility is driven by active hover/focus and zoom thresholds; no new route is introduced.
- Canvas uses `prefers-reduced-motion` to suppress ambient group drift while preserving pointer orbit and wheel zoom.

- [x] Add a failing contract for focus-visible node behavior, reduced-motion handling, and a foreground-safe node stacking layer.
- [x] Run the focused test and verify the expected failure.
- [x] Update node classes so labels sit above the canvas without obscuring the hero copy at default zoom; preserve keyboard focus styles and accessible labels.
- [x] Add a reduced-motion media query/flag consumed by the render loop for cloud, foliage, smoke, and firefly drift.
- [x] Run all related Vitest tests, ESLint, TypeScript check, and `git diff --check`.

## Verification Commands

```bash
pnpm vitest run src/components/home/landing/DioramaScene.test.ts src/components/home/landing/SpiritGardenHome.test.ts src/components/home/shell/SiteFooter.test.ts
pnpm exec eslint src/components/home/landing/DioramaScene.tsx src/components/home/landing/DioramaScene.test.ts
pnpm exec tsc --noEmit --pretty false
git diff --check
```

The existing repository-wide TypeScript baseline errors must be reported separately from any new `DioramaScene` errors.
