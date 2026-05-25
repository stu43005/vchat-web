# Legacy archive redirect — Design Spec

Date: 2026-05-25
Topic: When a user opens a `VideoCard` whose `archiveVersion < 2`, route
them through the SPA's existing video page instead of opening the legacy
HTML directly. The video page detects the legacy hint, probes the legacy
HTML with a HEAD request, and surfaces an "Open legacy archive" link
when the file is present.

---

## 1. Scope

### In scope

- Extend the existing `/videos/$videoId` route's search schema with two
  optional fields (`c`, `d`) carrying enough metadata to construct the
  legacy HTML URL without an extra data fetch.
- Change `VideoCard` so legacy entries navigate in-app to
  `/videos/$videoId?c=…&d=…` rather than opening the legacy HTML in a
  new tab. The "Legacy" chip overlay stays.
- Replace the static "Archive not yet available" `Alert` inside the
  video page's `NotFoundError` branch with a component that, when the
  legacy hint params are present, issues a HEAD request to the legacy
  HTML and upgrades the alert to "Legacy archive available" with an
  "Open legacy archive" button on success.
- Add a `fetchHead(path)` helper in [src/api/client.ts](../../../src/api/client.ts)
  for the new probe.

### Out of scope

- A standalone `/legacy/...` route. The brainstorming pass concluded
  the existing `/videos/$videoId` route is the right home: it already
  owns the "video not in the new archive" UX, and a separate route
  would just duplicate the surface.
- Changing the legacy HTML path scheme owned by honeybee
  (`/{channelId}/{YYYY-MM-DD}_{videoId}.html`).
- Direct visits to `/videos/$videoId` without the `c`/`d` hint do not
  perform a HEAD probe — there is no way to construct the URL without
  channel id + date, and fetching `channel.json` just to attempt a
  probe is out of scope.
- Storing or invalidating the HEAD result beyond the in-memory
  TanStack Query cache.
- Changing the "Legacy" chip behaviour or styling.

---

## 2. URL and search-param contract

The `/videos/$videoId` route's search schema gains two optional fields:

| Param | Type     | Meaning                                                                                    |
| ----- | -------- | ------------------------------------------------------------------------------------------ |
| `c`   | `string` | Channel id. Free-form opaque id, no length cap enforced.                                   |
| `d`   | `string` | 8-digit `YYYYMMDD` in Asia/Tokyo. Identical to what `ymdInTokyo` already returns and what `legacyVideoHref` puts into the legacy HTML path — no transformation needed in either direction. |

Both default to `undefined`. They are decorative — neither affects the
success path of loading `videoMeta` or `rows`. They are read only inside
the `meta.error instanceof NotFoundError` branch (see §4).

The `d` value MUST match `^\d{8}$`; zod rejects malformed input and the
rejected params are dropped silently (treated as absent). The `c`
value MUST be a non-empty string; any empty string is also dropped.

The new params slot alongside the existing `types` and `sigRange`
fields in `videoSearchSchema` at
[videos.$videoId.tsx:33](../../../src/routes/videos.$videoId.tsx#L33).
Existing `replace: true` navigations from `FilterChips` already spread
`...search`, so they preserve `c`/`d` automatically — no change needed
there.

---

## 3. VideoCard behaviour

Before:

- `isLegacy = video.archiveVersion < 2`
- If legacy → `<Box component="a" href={legacyVideoHref(...)} target="_blank">`
- Else → `<RouterAnchor to="/videos/$videoId" params={{ videoId }}>`

After:

- `isLegacy = video.archiveVersion < 2`
- Both branches use `<RouterAnchor to="/videos/$videoId" params={{ videoId: video.id }}>`.
- When `isLegacy`, the link additionally passes
  `search: { c: channel.id, d: ymdInTokyo(video.availableAt) }`.
- The conditional render of the "Legacy" chip overlay
  ([VideoCard.tsx:80-87](../../../src/components/VideoCard.tsx#L80-L87))
  is unchanged.
- The `legacyVideoHref` import is dropped from
  [VideoCard.tsx](../../../src/components/VideoCard.tsx). After this
  change VideoCard is the helper's only caller, so the helper itself
  is also deleted from
  [lib/format.ts](../../../src/lib/format.ts) — see §6.

UX consequences:

- Legacy clicks no longer open in a new tab — they navigate within the
  SPA. The Legacy chip already signals this is a non-standard target, so
  the in-app navigation is acceptable.
- The user lands on the same skeleton flash as a regular video page,
  followed by either the upgraded "Legacy archive available" alert
  (HEAD 200) or the existing "Archive not yet available" alert (HEAD
  failed / network error / params malformed).

---

## 4. Video-page meta-404 branch

Replace the inline `Alert` at
[videos.$videoId.tsx:65-78](../../../src/routes/videos.$videoId.tsx#L65-L78)
with a new component at `src/components/LegacyArchiveAlert.tsx`.

### 4.1 Props

```ts
interface LegacyArchiveAlertProps {
  videoId: string;
  channelId: string | undefined;
  dateYmd: string | undefined;
}
```

The video route passes:

- `videoId` from `Route.useParams()`
- `channelId` from `search.c`
- `dateYmd` from `search.d`

### 4.2 HEAD probe

Use `useQuery` from `@tanstack/react-query`:

- `queryKey: ['legacyHead', videoId, channelId, dateYmd]`
- `enabled: Boolean(channelId && dateYmd)`
- `queryFn`: composes the legacy path inline (see §4.4) and calls `fetchHead(path)`, returning its boolean result.
- `retry: false` — a single attempt is sufficient; we do not want exponential backoff for an inherently-may-not-exist resource.
- `staleTime: Infinity` — the legacy HTML is immutable for a given
  `(channelId, date, videoId)` tuple. Honeybee never republishes legacy
  files; if it did, the user would refresh.
- `gcTime`: default. The result is cheap to recompute.

### 4.3 Render states

The component always renders inside the existing `<Container sx={{ py: 2 }}>` wrapper from the meta-error branch.

| Condition                                                       | Severity | Title                       | Body                                                                                              | Action button                                                                          |
| --------------------------------------------------------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `enabled` and `query.isPending`                                 | `warning` | "Archive not yet available" | Existing copy + small inline `<CircularProgress size={16} sx={{ ml: 1 }} />` next to the body text. | none                                                                                   |
| `!enabled` (`c` or `d` absent)                                  | `warning` | "Archive not yet available" | Existing copy, no spinner.                                                                        | none                                                                                   |
| `enabled` and `query.data === true`                             | `info`    | "Legacy archive available"  | "An older HTML archive of this video is available. The new chat view is not yet generated."       | `<Button variant="outlined" size="small" component="a" href={…} target="_blank" rel="noopener noreferrer">Open legacy archive</Button>` (uses MUI `Alert action` slot) |
| `enabled` and `query.isError`                                   | `warning` | "Archive not yet available" | Existing copy, no spinner.                                                                        | none                                                                                   |
| `enabled` and `query.data === false`                            | `warning` | "Archive not yet available" | Existing copy, no spinner.                                                                        | none                                                                                   |

The "Action button" column refers exclusively to the MUI `Alert`
`action` prop (`<Alert action={<Button …/>}>…</Alert>`), **not** an
inline child of `<Alert>`. The `action` slot right-aligns the button
next to the alert title, matching the existing error-state retry
button at
[videos.$videoId.tsx:81-91](../../../src/routes/videos.$videoId.tsx#L81-L91).
For rows whose Action-button cell says "none", omit the `action` prop
entirely.

The "Existing copy" string is the current message at
[videos.$videoId.tsx:69-74](../../../src/routes/videos.$videoId.tsx#L69-L74):

> Archive not yet available
> This video has not yet been archived in the new format. If you have
> an older link, the legacy archive may be available.

For the success state ("Legacy archive available"), the body becomes:

> An older HTML archive of this video is available. The new chat view
> is not yet generated.

Both copies are plain MUI `Alert` children; no i18n today.

### 4.4 Implementation note

The legacy URL is composed inline — both `channelId` and `dateYmd`
arrive pre-formatted from the URL search params, so no helper call is
needed:

```ts
const legacyPath = `/${channelId}/${dateYmd}_${videoId}.html`;
```

This is the only sanctioned form. The implementer MUST NOT call
`legacyVideoHref` here: that helper takes an ISO `availableAt` and
re-derives the date via `ymdInTokyo`, but at this point we only have
the already-formatted `dateYmd` string. Synthesising a fake ISO
timestamp just to round-trip it through the helper would be both
fragile (timezone edge cases) and pointless (the inline template is
the shorter form of what the helper does anyway).

---

## 5. `fetchHead` helper

Add to [src/api/client.ts](../../../src/api/client.ts):

```ts
export async function fetchHead(path: string): Promise<boolean> {
  // path is an origin-rooted absolute path (e.g. "/UCxxxx/2024-01-01_abc.html").
  // Unlike fetchJson / fetchJsonl, this does NOT prepend DATA_BASE — legacy
  // HTML lives at the bucket root, not under /data/.
  const res = await fetch(path, { method: "HEAD", cache: "default" });
  return res.ok;
}
```

Notes:

- A 404 (or any non-2xx) makes `res.ok === false`, so `fetchHead`
  resolves to `false` — `fetch` does not reject on non-2xx responses
  per the WHATWG spec, matching the pattern already used in
  [fetchJson at client.ts:13-14](../../../src/api/client.ts#L13-L14).
  Network failures (DNS error, offline, CORS preflight failure) reject
  the underlying `fetch` promise; `fetchHead` lets the rejection
  propagate so `useQuery` enters its error state, which §4.3 treats
  identically to a `false` result.
- No `DATA_BASE` prefix; the legacy HTML lives at the origin root,
  unlike `fetchJson`/`fetchJsonl` whose targets sit under `/data/`.
- `cache: "default"` matches the other helpers — the browser HTTP
  cache may serve a previous HEAD without hitting the network.

---

## 6. Type and contract changes

| File                                  | Change                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/videos.$videoId.tsx`      | Add `c` and `d` to `videoSearchSchema`. Render `<LegacyArchiveAlert>` in the meta-404 branch instead of the inline `Alert`. |
| `src/components/VideoCard.tsx`         | Drop the `<a target="_blank">` legacy branch; always use `RouterAnchor`; emit `search: { c, d }` when `isLegacy`.            |
| `src/components/LegacyArchiveAlert.tsx` | New file. See §4.                                                                                                            |
| `src/api/client.ts`                    | Add `fetchHead`.                                                                                                              |
| `src/lib/format.ts`                    | Delete the now-unused `legacyVideoHref` export. `ymdInTokyo` stays — it is still called from VideoCard (§3) to build the `d` search-param value. |

No changes to `src/api/types.ts`, the queries layer, or routing
generation beyond what `tsr generate` produces from the updated route
file.

---

## 7. Edge cases

- **`c` present but `d` malformed**: zod drops `d`, the alert renders
  in the `!enabled` branch, no probe runs. Same as if `d` were absent.
- **`d` present but `c` absent**: symmetric — no probe.
- **Legacy video whose HTML really is missing on the bucket**: HEAD
  returns 404 → alert stays in "Archive not yet available" state. No
  button shown. User sees the original message they would have seen
  pre-change.
- **Legacy video whose HTML was migrated to v2 after the URL was
  shared**: `videoMeta.json` now exists, so the meta-404 branch never
  fires — the full video page renders, `c`/`d` are ignored. Acceptable.
- **Non-legacy video that someone navigated to with `?c=…&d=…`**:
  meta loads fine, alert never renders, probe never runs. The extra
  search params persist in the URL but are harmless.
- **HEAD CORS / opaque response**: the legacy HTML is served from the
  same origin as the SPA (S3 bucket root), so no CORS preflight or
  opaque-response issues.
- **`replace: true` navigations from `FilterChips`**: already spread
  `...search`, so `c`/`d` survive filter toggles within a legacy video
  page even though they have no effect on the meta-404 branch's
  visibility once meta has loaded.

---

## 8. Testing

No automated test scaffolding exists in this repo today; tests are
out of scope for this spec. Manual verification checklist:

1. Find a video with `archiveVersion < 2` in `index.json`. Confirm its
   `VideoCard` chip shows "Legacy" and the underlying anchor is the
   SPA route, not the `.html`. Confirm the URL query contains `c` and
   `d` after click.
2. Confirm that on landing on the legacy video page, the inline
   spinner appears momentarily and the alert upgrades to "Legacy
   archive available" with a working "Open legacy archive" button
   (opens in a new tab).
3. Confirm that visiting `/videos/<legacyId>` directly (no `c`/`d`)
   shows the existing "Archive not yet available" alert with no
   spinner and no button.
4. Confirm that visiting `/videos/<legacyId>?c=BAD&d=NOTADATE` is
   indistinguishable from #3 (zod drops malformed `d`, but `c=BAD`
   alone is still insufficient → alert with no spinner / button).
5. Confirm that a non-legacy video (archiveVersion ≥ 2) still loads
   the full video page; passing `?c=…&d=…` manually has no visible
   effect.
6. Confirm `npm run typecheck` and `npm run lint` pass.
