# Admin Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the entire `/admin/` management area in a professional light theme with neutral surfaces, graphite text, and a blue action accent regardless of the global theme.

**Architecture:** Scope a light theme override to the existing `.sg-admin` shell. Override the SpiritGarden variables consumed by admin descendants and add explicit dark-mode selectors so `next-themes` cannot make the admin area dark. Keep interaction cursors on the normal browser set, including workflow surfaces. Preserve all routing, auth, data queries, and component behavior.

**Tech Stack:** Next.js App Router, React, existing `src/app/globals.css` tokens, Vitest source assertions.

## Global Constraints

- Only change admin theme and cursor presentation; do not change routes, permissions, Supabase queries, or business copy.
- Use existing `--sg-*` variables and project CSS conventions; do not add dependencies or hex colors to new rules.
- Keep the current dirty worktree and unrelated changes intact.
- Verify the scoped regression and `git diff --check` before reporting completion.

---

### Task 1: Scope the admin area to the light theme

**Files:**
- Modify: `src/app/globals.css` near the existing `.sg-admin` rules
- Test: `src/components/admin/AdminShell.test.ts`

**Interfaces:**
- Consumes: the existing `.sg-admin` wrapper rendered by `AdminShell`.
- Produces: inherited light `--sg-*` tokens for all `/admin/` descendants, including workflow panels and modal surfaces.

- [ ] **Step 1: Add a failing source regression assertion**

  Extend the existing admin shell test with assertions that the global stylesheet contains the `.sg-admin` light-scope and `.dark .sg-admin` override selectors, plus `color-scheme: light`.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `pnpm exec vitest run src/components/admin/AdminShell.test.ts`

  Expected: FAIL because the light-theme selectors are not present yet.

- [ ] **Step 3: Add the minimal scoped CSS override**

  Add a light-theme block before the existing admin layout rules. Set the admin wrapper background and foreground to the light values, set `color-scheme: light`, and map the inherited SpiritGarden variables used by admin descendants (`--sg-cream`, `--sg-parchment`, `--sg-ink`, `--sg-ink-strong`, `--sg-green-mid`, `--sg-green-deep`, `--sg-green-light`, `--sg-border`, `--sg-error`, and related surface tokens) to the existing light palette. Repeat the same declarations under `.dark .sg-admin` so the global `.dark` class cannot override the admin area. Keep the values in `var(--color-*)`/existing token form rather than introducing new colors.

- [ ] **Step 4: Run the focused test and whitespace check**

  Run: `pnpm exec vitest run src/components/admin/AdminShell.test.ts && git diff --check`

  Expected: the source regression passes and no whitespace errors are reported.

- [ ] **Step 5: Run type/lint checks for touched admin files**

  Run: `pnpm eslint src/components/admin/AdminShell.tsx src/app/admin/layout.tsx src/app/admin/page.tsx`

  Expected: no ESLint errors. Existing unrelated worktree failures, if any, remain outside this change.

### Task 2: Verify the full admin surface

**Files:**
- Modify only files from Task 1 if verification exposes a scoped issue.

- [ ] **Step 1: Run all admin unit/source tests**

  Run: `pnpm exec vitest run src/components/admin src/app/admin`

  Expected: admin tests pass.

- [ ] **Step 2: Run the project typecheck**

  Run: `pnpm typecheck`

  Expected: typecheck completes successfully; report any unrelated baseline failures separately.

- [ ] **Step 3: Review the diff for scope**

  Confirm only the admin shell test and admin-scoped CSS changed, with no route, auth, query, or data behavior changes.
