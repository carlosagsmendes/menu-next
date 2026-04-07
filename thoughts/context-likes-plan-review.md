# Context Route Likes Plan — Review Notes

Reviewed: 2026-04-07
Source: Codex-generated plan

---

## Verdict

Mostly sound in intent with correct scope. Two design choices need revision before implementation, and the state machine needs more specification.

## Issues

### 1. DTO contamination (actionable)

Adding `likes` to `Post`/`PostDetail` in `data/dto.ts` changes the type contract for **all** consumers, including `/blog`. The plan says blog stays unchanged, but the types won't match.

**Fix:** Make `likes` optional (`likes?: number`) on `Post`, or create a separate `PostWithLikes` type. Only add `likes` to `PostDetail` if the list page truly never needs it.

### 2. Don't slot into PostContent — compose at the page level (actionable)

The plan proposes adding "optional slots for a title accessory and a lower-page accessory" to `PostContent`. This is unnecessary coupling:

- `PostContent` (`components/blog/PostContent.tsx`) is a pure server component shared by both `/blog` and `/context` routes.
- The likes controls are client components specific to `/context`.
- The page (`context/[id]/page.tsx`) already has full layout control.

**Fix:** Render likes UI as siblings in the page JSX instead of injecting slots into PostContent:

```tsx
<PostContent post={post} ... />
<TitleLikesControl postId={id} initialLikes={post.likes} />
...
<ClientDemoLikes postId={id} initialLikes={post.likes} />
```

This keeps PostContent untouched and avoids modifying shared code for a route-specific feature.

### 3. Layout provider wraps the list page for nothing (tradeoff)

`context/layout.tsx` would wrap `context/page.tsx` (the list page) in `ContextLikesProvider`, adding client JS to a page that doesn't use likes state.

**Alternatives:**
- Put the provider in `[id]/page.tsx` or `[id]/layout.tsx` — scoped to where it's actually needed.
- Accept the overhead as an intentional demo cost, but acknowledge the tradeoff explicitly.

If the goal is to demonstrate "route-scoped context via layout," then the overhead is the point — but the plan should say so.

### 4. State reconciliation on navigation is underspecified (needs spec)

The hook `useContextPostLikes(postId, initialLikes)` stores `{ serverCount, pendingClientDelta }` per postId. The layout persists across navigations (layouts don't remount), but the page re-renders on the server with fresh `initialLikes`.

**Unanswered questions:**
- **Return visit:** User likes post A (client delta = 3), navigates to B, returns to A. Server sends a new `initialLikes` — does the hook trust the client-modified value or re-initialize from server?
- **After server flush:** User clicks title control, server confirms `count = 15`. Does `pendingClientDelta` reset to 0? What if the user clicked the lower demo *during* the server action flight? That pending delta gets silently discarded.

This state machine needs a clearer spec before implementation.

### 5. Minor issues

- **`revalidatePath` target:** Should call `revalidatePath(`/context/${id}`)` with the concrete path, not the pattern `/context/[id]`.
- **No error handling on the action:** If the server action fails, the optimistic client state diverges permanently. Fine for a demo, but worth acknowledging.
- **In-memory store in serverless:** Likes won't persist across cold starts on Vercel. Plan calls this out as a demo — just confirming that's intentional.

---

## Scorecard

| Area | Verdict |
|---|---|
| Scope & isolation | Good — context-only changes |
| Server action pattern | Correct |
| DTO extension | Needs `likes?: number` or separate type |
| PostContent slots | Skip — compose at page level instead |
| Layout provider scope | Intentional tradeoff, should be explicit |
| State reconciliation | Underspecified — needs race condition handling |
| Test plan | Adequate for a demo |

## Required changes before implementation

1. Don't modify `PostContent` — compose likes UI at the page level
2. Make `likes` optional on the DTO or use a distinct type
3. Specify the delta/flush state machine (reconciliation on navigation, reset after server confirm, race condition during flight)
