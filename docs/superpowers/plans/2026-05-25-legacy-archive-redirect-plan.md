# Legacy archive redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each commit step MUST invoke the `git-master` skill per project CLAUDE.md — do not run `git commit` inline.

**Goal:** Replace VideoCard's "open legacy HTML in new tab" branch with an in-app navigation to `/videos/$videoId?c=…&d=…`; on that page, when meta 404s and both hint params are present, HEAD-probe the legacy HTML and surface an "Open legacy archive" link if it exists.

**Architecture:** Extend the existing `/videos/$videoId` route's zod search schema with two optional fields (`c`, `d`). Move the meta-404 inline `Alert` into a dedicated `LegacyArchiveAlert` component that owns the HEAD probe via `useQuery`. Add a `fetchHead` helper to the existing api/client. Delete the now-dead `legacyVideoHref`.

**Tech Stack:** React 19, TypeScript, Vite, @tanstack/react-router v1.170, @tanstack/react-query v5, @mui/material v9, zod v4.

**Project test convention:** No automated test scaffolding exists. After each code change, validate via `npm run typecheck` and `npm run lint`. The final task walks the manual verification checklist from the spec.

**Reference spec:** [docs/superpowers/specs/2026-05-25-legacy-archive-redirect.md](../specs/2026-05-25-legacy-archive-redirect.md)

---

## File overview

| File                                       | Action  | Responsibility                                                                                  |
| ------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| `src/api/client.ts`                        | Modify  | Add `fetchHead(path): Promise<boolean>` for origin-rooted HEAD probes.                          |
| `src/routes/videos.$videoId.tsx`           | Modify  | Add `c`, `d` to `videoSearchSchema`; render `<LegacyArchiveAlert>` in the meta-404 branch.       |
| `src/components/LegacyArchiveAlert.tsx`    | Create  | Owns the HEAD probe + three render states (pending/spinner, not-available, available + button). |
| `src/components/VideoCard.tsx`             | Modify  | Drop the `<a target="_blank">` legacy branch; always use `RouterAnchor`; pass `search={{c,d}}` when `isLegacy`. |
| `src/lib/format.ts`                        | Modify  | Delete the now-unused `legacyVideoHref` export.                                                 |

---

## Task ordering and dependencies

```
Task 1 (fetchHead)             ─┐
Task 2 (route search schema)   ─┼─► Task 4 (wire alert into route)
Task 3 (LegacyArchiveAlert)    ─┘
Task 2 (route search schema) ────► Task 5 (VideoCard emits c/d)
Task 5 ───────────────────────────► Task 6 (delete legacyVideoHref)
Task 6 ───────────────────────────► Task 7 (manual verification)
```

Tasks 1, 2, 3 are independent and can be executed in any order; the listed sequence is a convenient linear order.

---

### Task 1: Add `fetchHead` to `src/api/client.ts`

**Files:**
- Modify: `src/api/client.ts` (append a new exported function after `fetchJsonl`)

- [ ] **Step 1: Read the current file**

Run: `cat src/api/client.ts`

Expected content (for orientation):

```ts
import { parseJSONL } from "../lib/jsonl";

const DATA_BASE = (import.meta.env.VITE_DATA_BASE as string | undefined) ?? "/data";

export class NotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`not found: ${path}`);
    this.name = "NotFoundError";
  }
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`, { cache: "default" });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchJsonl<T>(path: string): Promise<T[]> {
  const res = await fetch(`${DATA_BASE}${path}`, { cache: "default" });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  const text = await res.text();
  return parseJSONL<T>(text);
}
```

- [ ] **Step 2: Append the `fetchHead` helper**

Append exactly this block to the bottom of `src/api/client.ts`:

```ts

export async function fetchHead(path: string): Promise<boolean> {
  // `path` is an origin-rooted absolute path (e.g. "/UCxxxx/20240101_abc.html").
  // Unlike fetchJson / fetchJsonl, this does NOT prepend DATA_BASE — the legacy
  // HTML lives at the bucket root, not under /data/.
  const res = await fetch(path, { method: "HEAD", cache: "default" });
  return res.ok;
}
```

Behavior notes (do not write these as code comments — they belong in the spec):
- Non-2xx (including 404) resolves to `false` because `res.ok === false`. `fetch` does not reject on non-2xx per WHATWG.
- Network failures (DNS error, offline, CORS preflight failure) reject the `fetch` promise; the rejection propagates so callers (`useQuery`) see an error state.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit via `git-master` skill**

Invoke the `git-master` skill with this commit message and file:

```
feat(api): add fetchHead helper for origin-rooted HEAD probes
```

Files to stage: `src/api/client.ts` (explicit path, do not use `git add -A`).

---

### Task 2: Extend `videos.$videoId` search schema with `c` and `d`

**Files:**
- Modify: `src/routes/videos.$videoId.tsx` (extend `videoSearchSchema` at lines 33-39 only — do NOT touch the meta-404 render branch yet; that is Task 4)

- [ ] **Step 1: Read the current schema**

Run: `sed -n '21,44p' src/routes/videos.$videoId.tsx`

Expected output includes:

```ts
const filterableTypeEnum = z.enum([
  "chat",
  "superChat",
  "superSticker",
  "membership",
  "membershipGift",
  "membershipGiftPurchase",
  "milestone",
  "poll",
  "raid",
]);

const videoSearchSchema = z.object({
  types: z.array(filterableTypeEnum).optional(),
  sigRange: z
    .tuple([z.number().int().min(1).max(7), z.number().int().min(1).max(7)])
    .refine(([lo, hi]) => lo <= hi, { message: "lo must be <= hi" })
    .optional(),
});
```

- [ ] **Step 2: Add `c` and `d` fields with silent-fallback behavior**

Edit `videoSearchSchema` to add two new fields:

```ts
const videoSearchSchema = z.object({
  types: z.array(filterableTypeEnum).optional(),
  sigRange: z
    .tuple([z.number().int().min(1).max(7), z.number().int().min(1).max(7)])
    .refine(([lo, hi]) => lo <= hi, { message: "lo must be <= hi" })
    .optional(),
  c: z.string().min(1).optional().catch(undefined),
  d: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .catch(undefined),
});
```

Rationale for `.catch(undefined)`:
- Per spec §2, malformed `c` or `d` MUST be dropped silently (treated as absent) without invalidating the rest of the schema.
- Verified for zod v4 (`node_modules/zod/v4/classic/schemas.d.ts:54-55`): `.catch(fallback)` returns the fallback when the schema fails.

No other code in the route changes in this task (the meta-404 render branch is rewritten in Task 4; existing `replace: true` navigations in `FilterChips` already spread `...search`, so `c`/`d` survive automatically — no edits needed there).

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors. (TanStack Router will regenerate `src/routeTree.gen.ts` and pick up the new optional fields.)

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit via `git-master` skill**

Commit message:

```
feat(video-route): accept optional c+d search params for legacy hints
```

Files to stage: `src/routes/videos.$videoId.tsx` and (if changed by `tsr generate`) `src/routeTree.gen.ts`.

---

### Task 3: Create `LegacyArchiveAlert` component

**Files:**
- Create: `src/components/LegacyArchiveAlert.tsx`

- [ ] **Step 1: Create the file with the full component**

Create `src/components/LegacyArchiveAlert.tsx` with exactly this content:

```tsx
import { Alert, Button, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { fetchHead } from "../api/client";

interface LegacyArchiveAlertProps {
  videoId: string;
  channelId: string | undefined;
  dateYmd: string | undefined;
}

export function LegacyArchiveAlert({
  videoId,
  channelId,
  dateYmd,
}: LegacyArchiveAlertProps) {
  const enabled = Boolean(channelId && dateYmd);
  // dateYmd is already YYYYMMDD and channelId is the bare id, so a template
  // literal yields the legacy path directly.
  const legacyPath = enabled
    ? `/${channelId}/${dateYmd}_${videoId}.html`
    : "";

  const query = useQuery({
    queryKey: ["legacyHead", videoId, channelId, dateYmd],
    queryFn: () => fetchHead(legacyPath),
    enabled,
    retry: false,
    staleTime: Infinity,
  });

  if (enabled && query.data === true) {
    return (
      <Alert
        severity="info"
        sx={{ maxWidth: 640 }}
        action={
          <Button
            variant="outlined"
            size="small"
            component="a"
            href={legacyPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open legacy archive
          </Button>
        }
      >
        <strong>Legacy archive available</strong>
        <div>
          An older HTML archive of this video is available. The new chat view
          is not yet generated.
        </div>
      </Alert>
    );
  }

  // When `enabled: false`, useQuery reports `isPending: true` with
  // `fetchStatus: 'idle'`. Gate on `enabled` so the spinner only renders
  // while a probe is actually in flight.
  const showSpinner = enabled && query.isPending;

  return (
    <Alert severity="warning" sx={{ maxWidth: 640 }}>
      <strong>Archive not yet available</strong>
      <div>
        This video has not yet been archived in the new format. If you have an
        older link, the legacy archive may be available.
        {showSpinner && (
          <CircularProgress
            size={16}
            sx={{ ml: 1, verticalAlign: "middle" }}
          />
        )}
      </div>
    </Alert>
  );
}
```

Why `<strong>` instead of `<AlertTitle>`: matches the existing inline alert at
[videos.$videoId.tsx:69-74](../../src/routes/videos.$videoId.tsx#L69-L74) so the
diff is minimal and the two warning-state alerts look identical to the user.

Why the direct `<CircularProgress size={16} sx={...} />` form: the spinner
is a visual cue inside the existing body text, not a standalone loader. Both
`size` and `sx` are native props on the MUI v9 `CircularProgress` component,
so the direct form is the only sanctioned form. Do NOT wrap in `<Box
component={CircularProgress}>` — that pattern is for promoting plain HTML
tags into MUI styling, not for MUI components that already accept `sx`.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit via `git-master` skill**

Commit message:

```
feat(legacy-alert): add LegacyArchiveAlert with HEAD probe
```

Files to stage: `src/components/LegacyArchiveAlert.tsx`.

---

### Task 4: Wire `LegacyArchiveAlert` into video route's meta-404 branch

**Files:**
- Modify: `src/routes/videos.$videoId.tsx` (replace the inline `Alert` at lines 65-78)

**Depends on:** Task 2 (`c`/`d` in search schema) and Task 3 (`LegacyArchiveAlert` exists).

- [ ] **Step 1: Read the current meta-404 branch**

Run: `sed -n '60,93p' src/routes/videos.$videoId.tsx`

Expected output includes:

```tsx
  // Meta error takes precedence (so a 404 surfaces "Archive not yet
  // available" immediately rather than after a skeleton flash).
  if (meta.isError) {
    if (meta.error instanceof NotFoundError) {
      return (
        <Container sx={{ py: 2 }}>
          <Alert severity="warning" sx={{ maxWidth: 640 }}>
            <strong>Archive not yet available</strong>
            <div>
              This video has not yet been archived in the new format. If you have
              an older link, the legacy archive may be available.
            </div>
          </Alert>
        </Container>
      );
    }
    return (
      ...
    );
  }
```

- [ ] **Step 2: Add the import for `LegacyArchiveAlert`**

Add to the import block at the top of `src/routes/videos.$videoId.tsx` (alphabetical order within the existing component imports):

```tsx
import { LegacyArchiveAlert } from "../components/LegacyArchiveAlert";
```

- [ ] **Step 3: Replace the inline `Alert` with `<LegacyArchiveAlert>`**

Edit the meta-404 branch so it reads:

```tsx
  if (meta.isError) {
    if (meta.error instanceof NotFoundError) {
      return (
        <Container sx={{ py: 2 }}>
          <LegacyArchiveAlert
            videoId={videoId}
            channelId={search.c}
            dateYmd={search.d}
          />
        </Container>
      );
    }
    return (
      ...
    );
  }
```

Keep the `<Container sx={{ py: 2 }}>` wrapper (per spec §4.3). Do not touch the non-404 error branch below it.

- [ ] **Step 4: Remove now-unused `Alert` import (if applicable)**

If `Alert` is no longer used anywhere else in `src/routes/videos.$videoId.tsx`, remove it from the `@mui/material` import. If it IS still used by the non-404 error branch, leave it.

Check via: `grep -n "Alert" src/routes/videos.$videoId.tsx`

Expected: at least one remaining usage (the non-404 error branch around line 81 uses `<Alert severity="error">`). Therefore, keep the `Alert` import.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 7: Commit via `git-master` skill**

Commit message:

```
feat(video-route): use LegacyArchiveAlert in meta-404 branch
```

Files to stage: `src/routes/videos.$videoId.tsx`.

---

### Task 5: VideoCard navigates legacy videos through the SPA

**Files:**
- Modify: `src/components/VideoCard.tsx` (lines 1-58 only — the chip overlay and card body are unchanged)

**Depends on:** Task 2 (`c`/`d` accepted by route schema).

- [ ] **Step 1: Read the current cardLink construction**

Run: `sed -n '1,58p' src/components/VideoCard.tsx`

Expected current shape:

```tsx
import { Avatar, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type {
  ChannelRef,
  VideoSummary,
  VideoSummaryWithoutChannel,
} from "../api/types";
import {
  formatCurrency,
  getYouTubeThumbnail,
  legacyVideoHref,
} from "../lib/format";
import { useTimezonePref } from "../lib/settings";
import { RouterAnchor } from "../lib/createMuiLink";
import { StatusText } from "./StatusText";

interface VideoCardProps { ... }

export function VideoCard({ video, channel, hideChannel = false }: VideoCardProps) {
  const [timezone] = useTimezonePref();
  const isLegacy = video.archiveVersion < 2;
  const thumbnailSrc = getYouTubeThumbnail(video.id);

  // ... overlayLinkSx ...

  const cardLink = isLegacy ? (
    <Box
      component="a"
      href={legacyVideoHref(video, channel)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={video.title}
      sx={overlayLinkSx}
    />
  ) : (
    <RouterAnchor
      to="/videos/$videoId"
      params={{ videoId: video.id }}
      aria-label={video.title}
      sx={overlayLinkSx}
    />
  );
```

- [ ] **Step 2: Swap the import for `legacyVideoHref` to `ymdInTokyo`**

Change the import block to drop `legacyVideoHref` and add `ymdInTokyo`:

```tsx
import {
  formatCurrency,
  getYouTubeThumbnail,
  ymdInTokyo,
} from "../lib/format";
```

(`ymdInTokyo` is needed to compute the `d` search-param value from
`video.availableAt`. It is already exported from `src/lib/format.ts:59-70`.)

- [ ] **Step 3: Rewrite `cardLink` to always use `RouterAnchor`, passing `search` only when legacy**

Replace the `cardLink` declaration with:

```tsx
  const cardLink = isLegacy ? (
    <RouterAnchor
      to="/videos/$videoId"
      params={{ videoId: video.id }}
      search={{
        c: channel.id,
        d: ymdInTokyo(video.availableAt),
      }}
      aria-label={video.title}
      sx={overlayLinkSx}
    />
  ) : (
    <RouterAnchor
      to="/videos/$videoId"
      params={{ videoId: video.id }}
      aria-label={video.title}
      sx={overlayLinkSx}
    />
  );
```

Two branches kept (instead of a single `RouterAnchor` with conditional `search` prop) because:
1. TanStack Router's object-literal `search={{...}}` is the correct call site for "navigate with brand-new search params" (confirmed via `node_modules/@tanstack/react-router` / docs). Conditionally spreading is unidiomatic and harder to type.
2. The non-legacy branch must produce a clean URL with no extra query string — omitting the prop is the cleanest way.

Do NOT change:
- the `isLegacy` calculation (line 24)
- the `Chip label="Legacy"` overlay (lines 80-87) — it stays as the user-visible signal
- the channel link, the thumbnail, the card body, the SC/Members/Gifts stack

- [ ] **Step 4: Verify no other references to `legacyVideoHref` remain in this file**

Run: `grep -n "legacyVideoHref" src/components/VideoCard.tsx`
Expected: no matches.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 7: Commit via `git-master` skill**

Commit message:

```
refactor(video-card): route legacy videos through SPA with c+d hints
```

Files to stage: `src/components/VideoCard.tsx`.

---

### Task 6: Delete dead-code `legacyVideoHref` from `src/lib/format.ts`

**Files:**
- Modify: `src/lib/format.ts` (delete lines 82-87 — the `legacyVideoHref` export)

**Depends on:** Task 5 (VideoCard dropped its import).

- [ ] **Step 1: Confirm VideoCard is the only caller (sanity check)**

Run: `grep -rn "legacyVideoHref" src/ docs/`

Expected matches:
- `docs/superpowers/specs/2026-05-25-legacy-archive-redirect.md` — historical references inside the spec (these are documentation and stay).
- `docs/superpowers/plans/2026-05-25-legacy-archive-redirect-plan.md` — this plan file (stays).
- `src/lib/format.ts:82-87` — the definition (about to be deleted).

There MUST NOT be any remaining `import { legacyVideoHref }` or `legacyVideoHref(` call site in `src/`. If there is, stop and resolve it before deleting.

- [ ] **Step 2: Read the current tail of format.ts**

Run: `sed -n '75,90p' src/lib/format.ts`

Expected:

```ts
}

export function legacyVideoHref(
  video: { id: string; availableAt: string },
  channel: { id: string },
): string {
  return `/${channel.id}/${ymdInTokyo(video.availableAt)}_${video.id}.html`;
}
```

- [ ] **Step 3: Delete the `legacyVideoHref` export**

Remove lines 82-87 (the entire `export function legacyVideoHref(...) { ... }` block plus the blank line preceding it if it leaves a trailing-newline issue). The file should end after `formatSuperAmount` (or whatever the immediately preceding declaration is) plus a single trailing newline.

Do NOT touch `ymdInTokyo` (lines 59-70) — VideoCard now imports it directly (Task 5).

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors. (If there is still a caller, TypeScript will fail here — go back to Step 1.)

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit via `git-master` skill**

Commit message:

```
refactor(format): drop dead legacyVideoHref export
```

Files to stage: `src/lib/format.ts`.

---

### Task 7: Manual verification per spec §8

**Files:** None (this task only runs the app).

**Depends on:** Tasks 1-6 complete.

- [ ] **Step 1: Confirm `.env.local` is configured for a real data source**

The dev server proxies `/data/*` to `VITE_DATA_PROXY` (see `vite.config.ts`). Without it, every video meta will 404 — which actually *helps* verify the meta-404 branch, but legacy HTML will also be unreachable so the HEAD probe will not return 200.

If you want to verify the HEAD-200 success path, ensure `.env.local` points at a deployment that hosts the legacy HTML (`VITE_DATA_PROXY` covers `/data/*`; the legacy HTML sits at the origin root, which is served by the same dev proxy if `vite.config.ts` is set up to forward unknown paths — check the proxy config). If the local dev server cannot reach the legacy HTML, document this limitation and skip steps 4-5.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: Vite reports `Local: http://localhost:5173` and starts without errors.

- [ ] **Step 3: Manual checklist — VideoCard navigation**

In a browser at `http://localhost:5173`:
1. Locate a video card whose `archiveVersion < 2` (the "Legacy" chip is visible at the top-left of the thumbnail).
2. Right-click → Copy link. Confirm the URL is `http://localhost:5173/videos/<videoId>?c=<channelId>&d=<YYYYMMDD>`. The path is the SPA route (NOT a `.html` file), and `c` + `d` are present.
3. Click the card. Confirm the browser navigates within the SPA (no new tab opens), the URL bar shows `/videos/<videoId>?c=…&d=…`.

- [ ] **Step 4: Manual checklist — HEAD-200 success path**

While still on the legacy video page from Step 3:
1. Observe the brief inline spinner inside the warning alert text while the HEAD probe runs.
2. After the probe resolves (typically <1s on local proxy), the alert should change to:
   - severity: info (blue tint)
   - title: "Legacy archive available"
   - right-aligned button: "Open legacy archive"
3. Click "Open legacy archive". Confirm a new tab opens at `/<channelId>/<YYYYMMDD>_<videoId>.html` and the legacy HTML renders.

If the legacy HTML is unreachable from the dev environment, the alert will stay in the "Archive not yet available" warning state — note this in the verification report.

- [ ] **Step 5: Manual checklist — direct visit (no c+d)**

In the browser, navigate to `http://localhost:5173/videos/<legacyVideoId>` (no query string).
Expected:
- Alert: severity warning, title "Archive not yet available", original body copy.
- No spinner (because `enabled` is false — `c` and `d` are absent).
- No "Open legacy archive" button.

- [ ] **Step 6: Manual checklist — malformed params**

Navigate to `http://localhost:5173/videos/<legacyVideoId>?c=BAD&d=NOTADATE`.
Expected:
- zod silently drops `d` (fails `^\d{8}$`); `c=BAD` is non-empty so it stays, but `enabled` requires both, so the alert renders in the same state as Step 5: warning, no spinner, no button.

- [ ] **Step 7: Manual checklist — non-legacy unchanged**

Navigate to a non-legacy video (`archiveVersion >= 2`) and confirm:
- Full video page renders (header, currency table, filter chips, chat list).
- URL has no `c` or `d` even if the user came from a VideoCard click.
- Manually appending `?c=foo&d=20240101` does not change the UI in any visible way.

- [ ] **Step 8: Final code-quality gate**

Stop the dev server. Run:

```
npm run typecheck && npm run lint && npm run build
```

Expected: all three exit 0. `npm run build` regenerates `src/routeTree.gen.ts` and produces `dist/` without errors.

- [ ] **Step 9: Commit the verification run (only if any code change was needed)**

If steps 3-8 surfaced any issue that required a code fix, commit each fix via the `git-master` skill with a clear message describing the fix. If nothing needed touching, skip this step — there is nothing to commit.

---

## Final summary checklist

Before declaring the implementation complete, verify each of these from a fresh shell:

- [ ] `grep -rn "legacyVideoHref" src/` returns no matches.
- [ ] `grep -rn "legacyVideoHref" docs/` returns matches only inside the spec and this plan (documentation references).
- [ ] `grep -n "target=\"_blank\"" src/components/VideoCard.tsx` returns no matches (the only legacy-HTML new-tab link is now inside `LegacyArchiveAlert` for the "Open legacy archive" button).
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` all exit 0.
- [ ] Manual checklist Steps 3-7 above all produced the expected behavior.
