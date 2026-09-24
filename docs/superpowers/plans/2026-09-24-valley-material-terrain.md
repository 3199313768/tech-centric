# Valley Material And Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Improve the central cabin and valley floor with grounded procedural materials and continuous terrain embedding while preserving the existing interactive diorama behavior.

**Architecture:** Keep the work inside `DioramaScene.tsx`, extending deterministic canvas-texture helpers, terrain placement helpers, and the existing named composition groups. Add source-contract tests beside the existing scene tests; no external model or texture dependency is introduced.

**Tech Stack:** Next.js 16, React 19, Three.js, TypeScript, Vitest, ESLint.

## Global Constraints

- Preserve the current cabin, stream, path, sky, cloud, pointer orbit, wheel zoom, story nodes, loading reveal, fallback image, and route links.
- Use local procedural resources only; do not add remote model or texture downloads.
- Keep all WebGL logic client-only and deterministic.
- Do not modify unrelated dirty-worktree files or commit changes.

### Task 1: Material profiles

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add failing contracts for directional wood grain, weathered roof/stone profiles, mottled ground materials, and roughness/normal/AO channels.
- [x] Run the focused scene test and verify the expected failure.
- [x] Add deterministic profile texture helpers and apply them to cabin wood, roof, stone, soil, grass, path, and stream bank materials.
- [x] Preserve existing animated water texture and authored-model PBR maps.
- [x] Run the focused scene test and verify it passes.

### Task 2: Terrain embedding

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add failing contracts for a shared terrain height helper, cabin terrace, raised rear shoulder, and lower stream-side edge.
- [x] Run the focused scene test and verify the expected failure.
- [x] Implement deterministic terrain elevation and use it to place the cabin details/foundation, path points, stream banks, and valley shoulder surfaces.
- [x] Keep the stream as the low point and preserve existing named foreground/midground/background groups.
- [x] Run the focused scene test and verify it passes.

### Task 3: Depth and grounding polish

**Files:**
- Modify: `src/components/home/landing/DioramaScene.tsx`
- Test: `src/components/home/landing/DioramaScene.test.ts`

- [x] Add failing contracts for contact-shadow coverage and foreground/midground/background material contrast.
- [x] Run the focused scene test and verify the expected failure.
- [x] Add restrained terrace contact shadows, damp edge variation, and background contrast adjustments without changing camera behavior.
- [x] Run the focused scene test and inspect the existing story/camera/loading contracts.

### Task 4: Verification

- [x] Run the related Vitest files for the scene, homepage, and footer.
- [x] Run ESLint on the touched scene files.
- [x] Run TypeScript and separate existing repository baseline errors from new scene errors.
- [x] Run `git diff --check` and preserve unrelated worktree changes.
