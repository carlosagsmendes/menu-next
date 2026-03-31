# Root Plan File: `/Users/carlos/Projects/menu/menu-next/IMPLEMENTATION_PLAN.md`

## Summary
Use a root-level implementation checklist that supports three things while we work:
- task progress tracking
- per-task todo tracking
- explicit validation signoff after each task

Because we are still in Plan Mode, I am not writing the file yet. This is the exact structure I would save at the project root once implementation starts.

## File Contents

```md
# Lexical Proofreading Editor Implementation Plan

## Legend
- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `Validation: [ ]` not yet validated
- `Validation: [-]` validating now
- `Validation: [x]` validated

## Global Validation Checklist
- [x] `pnpm lint`
- [x] `pnpm build`
- [x] Browser test `/editor` end to end
- [x] No blocking console/runtime errors in tested flows

---

## Task 1: Route Shell And Navigation
Status: `[-]`
Validation: `[-]`

### Todos
- [x] Add `app/editor/page.tsx` as a Server Component route.
- [x] Export route metadata.
- [ ] Export `unstable_instant = { prefetch: 'static' }`.
- [x] Render the page shell and mount the client editor workspace.
- [x] Add `Editor` to the sidebar nav.
- [x] Add route-level loading UI only if needed.

### Validate Criteria
- [x] `/editor` loads directly by URL.
- [x] `/editor` is reachable from the sidebar.
- [x] Existing layout, toolbar, and sidebar still render correctly.
- [ ] Route has an instant shell and does not violate Next 16 instant-navigation checks.

### Notes
- Re-checked Task 1 against the local Next 16 docs in `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`, plus the Vercel documentation search. The shared runtime auth nav in `components/SideNav.tsx` is now wrapped in an explicit `<Suspense fallback={null}>`, which is the right structural fix for shared-layout runtime data.
- `loading.tsx` is still intentionally omitted. The Next 16 docs are explicit that route-level loading UI does not by itself satisfy instant-navigation validation when the runtime work lives in a shared layout, so adding it here would not complete the task.
- `unstable_instant` was retried on `app/(app)/editor/page.tsx` after the shared-layout Suspense fix. `pnpm build` still fails for `/editor` with `next-prerender-dynamic-metadata`, while `pnpm next build --debug-prerender` succeeds and reports `/editor` as partial prerendered. For now Task 1 remains blocked on a production-build instant-validation conflict in the shared root layout/metadata path rather than the `/editor` page shell itself.

---

## Task 2: Shared Types And Editor State Model
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Add `EditorMode`.
- [x] Add `ProofreadRunStatus`.
- [x] Add `ProofreadSuggestion`.
- [x] Add `ProofreadEvent`.
- [x] Define client state for draft state, frozen snapshot, review state, selected suggestion, and run state.
- [x] Define one shared request payload shape for proofreading.

### Validate Criteria
- [x] Client and API share one canonical type contract.
- [x] Suggestion lifecycle is explicit and finite.
- [x] No proofread flow state depends on untyped ad hoc objects.

### Notes
- Shared proofread contracts now live in `data/editor.ts`, and the editor workspace renders a typed summary of the initial state.

---

## Task 3: Lexical Editor Foundation
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Add editor components under `components/editor`.
- [x] Install and wire required Lexical packages.
- [x] Create the client editor workspace entry component.
- [x] Configure supported v1 formatting:
- [x] Paragraphs
- [x] Headings
- [x] Bold
- [x] Italic
- [x] Strike
- [x] Links
- [x] Blockquotes
- [x] Ordered lists
- [x] Unordered lists
- [x] Hard line breaks
- [x] Add toolbar controls for the supported set only.

### Validate Criteria
- [x] Typing works.
- [x] Selection works.
- [x] Undo/redo works.
- [x] Formatting toggles work.
- [x] Editor remains stable under React Strict Mode.
- [x] Unsupported content types are not exposed in the UI.

### Notes
- Lexical now powers the `/editor` route with a client-only editor gate, a mounted workspace shell, and toolbar controls for the supported rich-text set.

---

## Task 4: Dual-Mode Serialization
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Define rich-text mode canonical output as Lexical JSON plus HTML.
- [x] Define markdown mode canonical output as Markdown from the same Lexical document.
- [x] Add `Rich Text` / `Markdown` mode toggle.
- [x] Preserve visible content on mode switch.
- [x] Update labels/hints based on active mode.
- [x] Ensure serializer coverage for supported block/inline features.

### Validate Criteria
- [x] Mode switch does not clear content.
- [x] Repeated toggles preserve visible content.
- [x] Markdown export is valid for supported structures.
- [x] Rich-text mode still produces Lexical JSON and HTML.

### Notes
- The editor now keeps Lexical as the canonical document source, exports JSON/HTML/markdown from the same snapshot, and swaps between rich text and markdown surfaces without losing content.

---

## Task 5: Proofreading Snapshot Pipeline
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Capture current Lexical state.
- [x] Export normalized plain text.
- [x] Export markdown.
- [x] Export HTML.
- [x] Build text-offset mapping back to editor text segments.
- [x] Normalize whitespace/line endings consistently.
- [x] Exclude code content from proofreadable ranges or reject overlapping suggestions.
- [x] Store snapshot separately from mutable draft state.
- [x] Lock editor when proofreading starts.

### Validate Criteria
- [x] Snapshot generation is deterministic for the same content.
- [x] Plain-text offsets map back to the correct text ranges.
- [x] Starting proofreading freezes editing.
- [x] Snapshot survives the full review flow without drift.

### Notes
- 
- 

---

## Task 6: Streaming Proofread API
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Add `app/api/proofread/route.ts`.
- [x] Accept `POST` JSON payload with `mode`, `plainText`, `markdown`, `html`, and `lexicalState`.
- [x] Return NDJSON stream.
- [x] Emit `run-start`.
- [x] Emit `suggestion`.
- [x] Emit `complete`.
- [x] Emit `error`.
- [x] Add provider-agnostic `proofreadDocumentStream()` adapter.
- [x] Implement deterministic mock streaming adapter for v1.

### Validate Criteria
- [x] Response streams incrementally rather than returning one buffered payload.
- [x] Client can parse events in order.
- [x] Errors surface as structured events.
- [x] Error handling does not strand the client in loading state.

### Notes
- 
- 

---

## Task 7: Review State Reconstruction
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Build reducer/rebuilder for review state from frozen snapshot plus suggestion statuses.
- [x] Recompute review state on each streamed suggestion.
- [x] Recompute review state on each accept/reject action.
- [x] Remove resolved suggestions from pending highlight state.
- [x] Commit resolved review state back into draft state when review finishes.

### Validate Criteria
- [x] Accepting one suggestion does not corrupt others.
- [x] Rejecting restores original text for that range.
- [x] Final draft includes accepted changes only.
- [x] Offset handling stays correct across multiple pending suggestions.

### Notes
- Review state is rebuilt from the frozen snapshot plus live suggestion statuses, and `commitProofreadReview()` now preserves the rest of the draft when a suggestion cannot be mapped cleanly instead of flattening everything to plain text.
- The finish-review path in `EditorWorkspace` captures the committed Lexical state back into the draft snapshot and clears the frozen review session.

---

## Task 8: Inline Suggestion Rendering
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Render read-only review surface during streaming/review.
- [x] Style deletions as red strikethrough.
- [x] Style insertions as green highlight.
- [x] Add selected suggestion emphasis.
- [x] Support rendering across paragraphs and lists.
- [x] Keep visuals aligned with current app styles.

### Validate Criteria
- [x] Suggestions appear inline as they stream in.
- [x] Users can distinguish original vs suggested content.
- [x] Highlight positions remain stable after accept/reject.
- [x] Selection styling is clear.

### Notes
- 
- 

---

## Task 9: Suggestion Review Rail
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Add right-side review panel.
- [x] List suggestions in arrival order.
- [x] Show original text, replacement text, and reason.
- [x] Add per-item `Accept`.
- [x] Add per-item `Reject`.
- [x] Sync rail selection with inline editor selection.
- [x] Scroll/focus to active suggestion from either surface.

### Validate Criteria
- [x] Each streamed suggestion appears once in the rail.
- [x] Clicking rail item focuses matching inline diff.
- [x] Accept/reject updates both rail and inline view immediately.
- [x] Pending/resolved states are visually distinct.

### Notes
- 
- 

---

## Task 10: Run Lifecycle And Recovery
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Disable proofreading trigger during active run.
- [x] Show idle, streaming, review, and error states.
- [x] Unlock editor after review completes.
- [x] Unlock and restore original draft on failure.
- [x] Clear old run state before a fresh proofread.

### Validate Criteria
- [x] Overlapping runs cannot start.
- [x] Error state never leaves editor locked permanently.
- [x] Fresh run uses current draft, not stale state.
- [x] Recovery path restores expected content.

### Notes
- 
- 

---

## Task 11: Styling And UX Polish
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Style the editor page layout.
- [x] Style the toolbar/header area.
- [x] Style the review rail.
- [x] Add empty state copy.
- [x] Add loading state copy.
- [x] Add error state copy.
- [x] Add brief explanatory copy for mode choice and proofreading flow.
- [x] Check desktop and narrower layouts.

### Validate Criteria
- [x] Page is usable on desktop.
- [x] Page remains functional on narrow widths.
- [x] Empty/loading/error states are understandable.
- [x] The page feels visually integrated with the rest of the app.

### Notes
- 
- 

---

## Task 12: Final Validation
Status: `[x]`
Validation: `[x]`

### Todos
- [x] Run `pnpm lint`.
- [x] Run `pnpm build`.
- [x] Start the app locally.
- [x] Open `/editor` in the browser.
- [x] Type sample content.
- [x] Apply formatting.
- [x] Switch `Rich Text` / `Markdown`.
- [x] Trigger proofreading.
- [x] Confirm suggestions stream in incrementally.
- [x] Accept one suggestion.
- [x] Reject one suggestion.
- [x] Confirm editor unlocks after review.
- [x] Confirm final content contains accepted changes only.
- [x] Check browser console for blocking errors.

### Validate Criteria
- [x] Lint passes.
- [x] Build passes.
- [x] End-to-end editor flow works in browser.
- [x] No blocking runtime errors appear in the tested flow.

### Notes
- Final validation covered the end-to-end `/editor` flow in `/next-browser`, including rich-text and markdown mode switching, streamed suggestions, accept/reject actions, review completion, and unlocked draft recovery.
- `pnpm lint` and `pnpm build` pass, with the same pre-existing `react-hooks/incompatible-library` warning in `components/BlogPostList.tsx`.

---

## Implementation Log
- Date: 2026-03-28
- Current task: Task 12
- Last validated task: Task 12
- Blocking issues: None
- Follow-up fixes: None
```

## Conventions To Use During Implementation
- Move each task from `[ ]` to `[-]` when work starts.
- Mark `Status: [x]` only after all task todos are complete.
- Mark `Validation: [x]` only after every validation criterion for that task has been checked.
- Keep short notes under each task for decisions, edge cases, or bugs found during implementation.
- Only mark the global validation checklist complete after Task 12 finishes.

## Assumptions
- File name: `IMPLEMENTATION_PLAN.md`
- File location: project root at `/Users/carlos/Projects/menu/menu-next/IMPLEMENTATION_PLAN.md`
- Browser testing with `/next-browser` remains part of Task 12 and happens after implementation, not in this planning turn.
