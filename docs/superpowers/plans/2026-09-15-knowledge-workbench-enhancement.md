# Knowledge Workbench Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the personal knowledge admin page into a compact maintenance workspace with search, filters, create/edit/delete actions, and reliable async states.

**Architecture:** Keep the existing `/admin/knowledge` route and Supabase query layer. Add a client-side workbench component for controlled filters, dialog state, and mutations; keep server-side permission checks and initial data loading in the page. Reuse the existing `sg-*` design tokens and avoid database/schema changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase browser client, Vitest, existing SpiritGarden CSS.

## Global Constraints

- Preserve the existing `/admin/knowledge` route, permission check, and record fields.
- Do not add dependencies or change the database schema.
- Use complete TypeScript types; no `any` or unexplained `@ts-ignore`.
- Use existing `sg-*` styles and CSS variables; no new hex colors.
- Prevent duplicate submits and ignore stale async results after unmount.
- Keep error and empty states accessible and actionable.

### Task 1: Define knowledge mutation and filtering contracts

**Files:**
- Create: `src/lib/knowledge/admin.ts`
- Test: `src/lib/knowledge/admin.test.ts`

**Interfaces:**
- `KnowledgeDraft = { type: string; content: string; tags: string[] }`
- `KnowledgeFilters = { keyword: string; type: string; tag: string }`
- `filterKnowledgeRecords(records, filters): KnowledgeRecord[]`
- `parseKnowledgeTags(value: string): string[]`
- `serializeKnowledgeTags(tags: string[]): string[]`

- [ ] Write tests for keyword matching across `type` and `content`, exact type/tag filtering, whitespace normalization, and empty filters.
- [ ] Run `pnpm exec vitest run src/lib/knowledge/admin.test.ts` and confirm the new tests fail before implementation.
- [ ] Implement pure filtering/tag helpers without Supabase access.
- [ ] Run the focused test file and confirm it passes.

### Task 2: Add the knowledge workbench client component

**Files:**
- Create: `src/components/admin/KnowledgeWorkbench.tsx`
- Create: `src/components/admin/KnowledgeWorkbench.test.tsx`

**Interfaces:**
- Props: `{ initialRecords: KnowledgeRecord[] }`
- Mutation callbacks use the Supabase client and return `Promise<void>`.

- [ ] Write component tests covering initial table rendering, keyword/type/tag filtering, empty filtered state, opening create/edit dialogs, and preventing a second submit while saving.
- [ ] Run the focused component test and confirm it fails before implementation.
- [ ] Implement controlled search/filter inputs, a shared create/edit dialog, and delete confirmation.
- [ ] Use a request guard/ref plus mounted guard so rapid clicks cannot duplicate mutations and unmounted components do not receive state updates.
- [ ] Refresh local records after successful mutations and keep form values/error text after failures.
- [ ] Add `/` search focus and `Escape` dialog close with cleanup for the keyboard listener.
- [ ] Run the focused component test and confirm it passes.

### Task 3: Integrate the workbench into the server page

**Files:**
- Modify: `src/app/admin/knowledge/page.tsx`

- [ ] Keep `requireSuperAdmin` and `fetchKnowledgePageData` in the server component.
- [ ] Replace the read-only table branch with `KnowledgeWorkbench initialRecords={records}` while preserving the existing error state.
- [ ] Keep the existing no-record state actionable through the client component's create button.
- [ ] Run `pnpm eslint src/app/admin/knowledge/page.tsx src/components/admin/KnowledgeWorkbench.tsx`.

### Task 4: Add scoped admin styles and regression verification

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/admin/AdminShell.test.ts` only if shared behavior needs coverage

- [ ] Add compact toolbar, filter controls, dialog, form, confirmation, and inline error styles using existing tokens.
- [ ] Verify mobile layout has no horizontal overflow and buttons/text remain readable.
- [ ] Run `pnpm exec vitest run src/lib/knowledge/admin.test.ts src/components/admin/KnowledgeWorkbench.test.ts src/components/admin/AdminShell.test.ts src/app/admin/page.test.ts`.
- [ ] Run `pnpm eslint src/app/admin/knowledge/page.tsx src/components/admin/KnowledgeWorkbench.tsx src/lib/knowledge/admin.ts`.
- [ ] Run `git diff --check`.
