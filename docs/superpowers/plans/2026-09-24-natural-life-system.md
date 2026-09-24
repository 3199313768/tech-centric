# Natural Life System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Add a coherent wind field, directional stream movement, and ecological vegetation distribution to the forest valley without changing camera or story interactions.

**Architecture:** Extend the existing `DioramaScene.tsx` animation loop with deterministic environmental drivers. Keep authored and procedural foliage in their existing named groups, use shared phases for wind, and add small water-ripple meshes near stream stones. Add source-contract tests in the existing scene test file.

**Tech Stack:** Next.js 16, React 19, Three.js, TypeScript, Vitest, ESLint.

## Global Constraints

- Preserve cabin, terrain materials, stream/path placement, story nodes, camera controls, model reveal, fallback image, and reduced-motion behavior.
- Use local procedural geometry only; do not add remote assets or animation dependencies.
- Keep motion subtle, deterministic, and disabled when `prefers-reduced-motion: reduce` is active.
- Do not modify unrelated dirty-worktree files or commit changes.

### Task 1: Shared wind field

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add failing contracts for a shared `windField`, phase-based tree/understory motion, and reduced-motion gating.
- [x] Run the focused scene test and verify the expected failure.
- [x] Add deterministic wind samples and apply them to authored trees, procedural crowns, understory groups, and smoke using different amplitudes by layer.
- [x] Preserve the existing no-auto-camera-rotation contract.
- [x] Run the focused scene test and verify it passes.

### Task 2: Stream movement and stone ripples

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add failing contracts for stream flow direction, ripple meshes, and water/stone proximity naming.
- [x] Run the focused scene test and verify the expected failure.
- [x] Animate the existing water texture along the stream tangent and add small transparent ripple rings around selected stream stones.
- [x] Keep ripple opacity and water offset disabled in reduced-motion mode.
- [x] Run the focused scene test and verify it passes.

### Task 3: Ecological distribution

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add failing contracts for creek-bank, cabin-clearance, and slope-forest placement groups.
- [x] Run the focused scene test and verify the expected failure.
- [x] Group existing understory and authored tree placements by ecological zone, adding deterministic density/scale variation without changing the central focal area.
- [x] Add low-cost dampness cues at creek edges and keep foreground/midground/background contrast intact.
- [x] Run the focused scene test and inspect existing material, terrain, camera, and loading contracts.

### Task 4: Verification

- [x] Run the related Vitest files for the scene, homepage, and footer.
- [x] Run ESLint on the touched scene files.
- [x] Run TypeScript and separate existing repository baseline errors from new scene errors.
- [x] Run `git diff --check` and preserve unrelated worktree changes.
