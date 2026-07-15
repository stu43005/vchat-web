# Sidebar navigation + realtime / upcoming / daily views

**Date:** 2026-07-15
**Status:** Design (approved, pending spec review)

## 1. Summary

Adopt honeybee's newer per-purpose data files and reshape the SPA's
top-level navigation around them. Three new data files replace the
deprecated `root-index` (`data/index.json`) for browsing:

- `data/realtime.json` — currently live streams.
- `data/upcoming.json` — scheduled streams + just-started streams.
- `data/daily-videos/{YYYY-MM-DD}.json` — per-JST-day list of started
  streams.

The SPA gains a persistent left sidebar for primary navigation, an
index route driven by `realtime.json`, a new `/upcoming` route, and a
new `/daily/$date` route with in-page date and sort controls. Every
video summary also gains four optional fields
(`viewers`, `maxViewers`, `likes`, `premiere`).

This is a **reader-only** change. All three files and the four new
fields are already emitted by honeybee at contract version 1 (additive
/ Path A). No honeybee PR, dual-version reader, or contract markdown
change is required on the vchat-web side. The SPA simply starts reading
files the writer already produces.

`viewers`, `maxViewers`, and `likes` are surfaced as an icon row
beneath the existing status text. `premiere` and `duration` drive a
YouTube-style badge overlaid on the video-card thumbnail (§7.2).

## 2. Goals

- Replace the index route's `live`/`past` Tabs with a realtime-driven
  "Live" view.
- Add an `/upcoming` route showing recently-started and scheduled
  streams in two stacked sections.
- Add a `/daily/$date` route showing a per-JST-day video list with a
  date switcher and a sort switcher (sort carried in a search param).
- Add a persistent left sidebar (permanent on desktop, temporary drawer
  on mobile) with four navigation entries.
- Surface `viewers` / `maxViewers` / `likes` as a Material-Icon row with
  tooltips beneath the status text on video cards and the video header.
- Overlay a YouTube-style live/duration badge on the video-card
  thumbnail (bottom-right): a ticking live elapsed timer / "Premiere" /
  "Live" while live, and a formatted duration for ended streams.
- Remove now-dead `IndexData` / `useIndexQuery` reader code.

## 3. Non-goals / Accepted limitations

- **No reconstruction of the "recently ended (within 48h)" past view.**
  `root-index`'s `past` array is intentionally dropped. `daily-videos`
  buckets a stream by its **start** JST day and does not preserve
  `past`'s recently-ended semantics — a long-running stream that started
  before yesterday but ended recently appears in `past` but in no
  scheduled today/yesterday daily file. Composing an equivalent view is
  out of scope for this change.
- **No auto-refresh / polling.** `realtime.json` and `upcoming.json`
  regenerate every minute upstream, but the SPA fetches them only on
  route entry (no `refetchInterval`). Live viewer counts may therefore
  be up to a minute or more stale; this is accepted to keep request
  volume minimal.
- **No new test framework.** The project currently has no test harness
  (no Jest/Vitest, no `test` script). Verification for this change is
  `npm run typecheck` + `npm run lint` + `npm run build` + manual
  exercise of each route. Introducing a test runner is out of scope.
- **No removal of the honeybee `root-index` writer.** That writer is
  retained upstream; this change only stops the SPA from reading
  `index.json`.
- **`premiere` is displayed only in the thumbnail badge.** When
  `status === "live"` and `premiere === true`, the thumbnail badge reads
  "Premiere" (§7.2). `premiere` is not surfaced anywhere else (no
  metrics-row entry, no separate chip).
- **No dual-reader / `index.json` fallback for the new files.**
  - **Concern (reviewer):** removing `useIndexQuery` and reading only the
    new files leaves no fallback if `realtime.json` / `upcoming.json`
    404 during a partial rollout; usable `index.json` data could exist
    while the home page renders empty.
  - **Decision:** not implemented.
  - **Rationale:** disproportionate to this project's deployment model.
    The three new files are already emitted in production (contract v1,
    since 2026-07-11/07-12); the SPA and `/data` share one S3
    bucket/origin and the SPA deploy never touches `/data`, so there is
    no realistic window where the SPA ships while the data files are
    absent. `daily-videos` has no `index.json` equivalent to fall back
    to at all. A 404 on these files is therefore treated as an ordinary
    error/empty state (§8), not a migration path.
- **No runtime schema validation / version gating of the new payloads.**
  - **Concern (reviewer):** without runtime validation (e.g. zod) and a
    contract-version check, schema drift or a stale environment could
    silently render wrong counts, empty lists, or bad sorting instead of
    failing fast with a compatibility error.
  - **Decision:** not implemented.
  - **Rationale:** inconsistent with the established codebase pattern and
    disproportionate. `fetchJson` casts every JSON payload
    (`index`/`channel`/`meta`) with `as T` today; the only zod-validated
    path is per-line JSONL parsing, because a streaming line format is
    the highest-risk input. The new files are single-version (v1), and v1
    carries **no** `version` field (the contract detects version by its
    absence ⇒ v1), so a version check would be inert now. The reader
    parses the v1 shape and ignores unknown fields (forward
    compatibility), matching how the app already reads its other JSON.
- **Legacy `/?tab=…` links resolve to the Live view by design.** The
  index route drops its `?tab` search param along with the recently-ended
  past view (the first Non-goal above). A bookmarked or shared
  `/?tab=past` URL now shows Live rather than past content; the param is
  ignored, not redirected. This is an accepted consequence of removing
  the past view, not a separate feature to migrate.

## 4. Data contract classification

- **Path A (additive), reader catching up.** The three new file-type
  documents (`realtime`, `upcoming`, `daily-videos`) are all at version
  1. The four new video-summary fields were added to `root-index` as an
  additive revision and are present on the new files too. No field is
  renamed, retyped, or re-encoded by this change.
- **Version handling.** Only version 1 exists for every file consumed
  here. The reader parses the version-1 shape directly and ignores any
  unknown extra fields (forward compatibility). No `version` field is
  read or asserted. A future breaking bump would be handled then, not
  now.
- **No contract markdown edits.** This spec touches only the vchat-web
  repo. It does not modify any honeybee `docs/data-contract/*` file and
  introduces no Path B vocabulary.

## 5. Data layer

### 5.1 Type additions (`src/api/types.ts`)

Add four optional fields to `VideoSummary`. They flow automatically into
`VideoSummaryWithoutChannel` (via `Omit`) and `VideoMeta` (via
`extends`):

```ts
export interface VideoSummary {
  // …existing fields unchanged…
  viewers?: number;    // live concurrent viewers; 0 after finish
  maxViewers?: number; // peak concurrent viewers; persists after finish
  likes?: number;      // like count; persists after finish
  premiere?: boolean;  // true for YouTube premieres
}
```

New payload types. The contract's `VideoSummaryWithChannel` is
structurally equal to the SPA's `VideoSummary` (channel object plus the
new optional fields), so `VideoSummary` is reused directly:

```ts
export interface RealtimeIndex {
  snapshotAt: string;
  live: VideoSummary[];
}

export interface UpcomingIndex {
  snapshotAt: string;
  upcoming: VideoSummary[];
  recentlyStarted: VideoSummary[];
}

export interface DailyVideos {
  date: string;       // "YYYY-MM-DD" (JST) — the day this file lists
  snapshotAt: string;
  videos: VideoSummary[];
}
```

`IndexData` is **removed** from this file.

### 5.2 Query hooks (`src/api/queries.ts`)

All new hooks reuse the existing `retryOnNon404` retry predicate and set
`refetchOnWindowFocus: false`. **No hook sets `refetchInterval`.**

- `useRealtimeQuery(): UseQueryResult<RealtimeIndex>` →
  `fetchJson<RealtimeIndex>("/realtime.json")`, `queryKey: ["realtime"]`,
  `staleTime: 60_000`.
- `useUpcomingQuery(): UseQueryResult<UpcomingIndex>` →
  `fetchJson<UpcomingIndex>("/upcoming.json")`, `queryKey: ["upcoming"]`,
  `staleTime: 60_000`.
- `useDailyVideosQuery(dateParam: string | undefined):
  UseQueryResult<{ resolvedDate: string; data: DailyVideos }>` — see
  §5.3 for the "today" fallback. `enabled: Boolean(dateParam)`.

`useIndexQuery` and its `IndexData` import are **removed**.

### 5.3 `daily` date resolution + fallback

`useDailyVideosQuery` accepts the raw route param, which is either the
literal string `"today"` or a `YYYY-MM-DD` date.

- **`dateParam === "today"`:** the `queryFn` computes the current JST
  date via `todayYmdInTokyo()` and fetches that file. On a
  `NotFoundError` (the day may have just rolled over before the writer
  produced today's file), it retries once with the previous JST day
  (`addDaysYmd(today, -1)`). It returns
  `{ resolvedDate, data }` where `resolvedDate` is whichever date
  actually resolved. If the fallback day also 404s, the `NotFoundError`
  propagates (surfaced as "No data for this date", per §6.5 / §8).
- **`dateParam` is a concrete `YYYY-MM-DD`:** the `queryFn` fetches only
  that file and does **not** fall back. `resolvedDate` equals
  `dateParam`. A 200 with `videos: []` is a valid empty day; a 404 means
  the file was never generated.
- **`queryKey`:** `["daily", dateParam]`. Because the key includes the
  literal `"today"`, the today view and a concrete-date view of the same
  calendar day are cached under distinct keys; this is acceptable (at
  most one extra fetch). The retry predicate still skips 404 so the
  yesterday fallback is driven inside the `queryFn`, not by React
  Query's retry loop.
- The fallback logic lives entirely inside the `queryFn` (fetch today,
  `catch` `NotFoundError`, fetch yesterday) so the hook issues a single
  logical query and there is no two-render flash: either it resolves to
  data or errors.
- **Stale-fallback refresh.** When the `"today"` query falls back to the
  previous day (`resolvedDate !== todayYmdInTokyo()`), the result is
  based on stale data — the real today file will appear upstream shortly
  after the rollover, but with no polling and `refetchOnWindowFocus:
  false` a cached yesterday result would otherwise persist for the
  logical today route. To bound this: the `"today"` query sets
  `staleTime: 0` **whenever it resolved via the fallback branch** (a
  clean today result keeps the normal `staleTime: 60_000`). Combined with
  React Query's default `refetchOnMount`, the next mount/navigation to
  `/daily/today` re-attempts today's concrete file, so a stale-yesterday
  view self-corrects on the user's next visit rather than sticking until
  a hard reload. This is a best-effort correction, not a live auto-update
  (consistent with the no-polling Non-goal). For a user sitting on the
  page across the rollover, the route also renders an explicit
  stale-fallback notice with a Retry control (§6.5) so the yesterday
  result is never silently labeled as today; recovery stays user-driven.

### 5.4 Date / duration helpers (`src/lib/format.ts`)

Add four pure helpers alongside the existing `ymdInTokyo`:

- `todayYmdInTokyo(): string` — current JST date as `"YYYY-MM-DD"` using
  `Intl.DateTimeFormat` with `timeZone: "Asia/Tokyo"`.
- `ymdDashInTokyo(iso: string): string` — an ISO instant to its JST
  calendar date as `"YYYY-MM-DD"`. (The existing `ymdInTokyo` returns
  `"YYYYMMDD"` without dashes and is kept unchanged for the legacy
  redirect path.)
- `addDaysYmd(ymd: string, delta: number): string` — pure calendar-date
  arithmetic on a `"YYYY-MM-DD"` string. Implemented by parsing the
  parts into `Date.UTC(y, m-1, d)`, adding `delta * 86_400_000`, and
  reformatting from the UTC fields. Using UTC construction keeps the
  arithmetic free of the host timezone and DST — the string is treated
  as a bare calendar date, not an instant.
- `formatDuration(seconds: number): string` — YouTube-style clock format
  from a whole-second count. `≥ 3600 s` → `"H:MM:SS"` (hours unpadded,
  minutes/seconds zero-padded); otherwise → `"M:SS"` (minutes unpadded,
  seconds zero-padded). Negative or non-finite input is clamped to `0`
  and renders `"0:00"`. Used for both the ended-stream duration and the
  live elapsed timer (§7.2).

## 6. Routing and layout

### 6.1 App shell (`src/routes/__root.tsx`)

The root layout wraps `<Outlet>` with a left sidebar shown on **all**
routes:

- **Desktop (≥ `sm`):** a `permanent` MUI `Drawer` occupying a fixed
  width on the left; content area sits to its right.
- **Mobile (< `sm`):** a `temporary` `Drawer` toggled by a new hamburger
  `IconButton` added to `TopBar`. It overlays content and closes on
  navigation or backdrop click.
- The mobile-open state is a `useState<boolean>` owned by `RootLayout`
  and passed down to both `TopBar` (to render + wire the hamburger) and
  `AppSidebar` (open/close). Desktop does not use this state.
- `TopBar` keeps its breadcrumbs, timezone menu, and theme toggle. The
  existing `--topbar-h` `ResizeObserver` behavior is unchanged.

### 6.2 Sidebar (`src/components/AppSidebar.tsx`, new)

Four navigation entries. Labels are English. Active state is derived
from the router (`matchRoute` / `Link` active props); the two daily
ranking entries are active only when both the path is `/daily/today`
**and** the current `sort` search param matches the entry's sort.

| Label | Destination |
| --- | --- |
| Live | `/` |
| Upcoming | `/upcoming` |
| Top Viewers Today | `/daily/today?sort=maxViewers` |
| Top Likes Today | `/daily/today?sort=likes` |

Each entry uses a Material Icon (e.g. `LiveTvIcon`, `ScheduleIcon`,
`VisibilityIcon`, `ThumbUpIcon`). Navigation uses the router `Link`
wrappers already in the codebase.

### 6.3 Index route (`src/routes/index.tsx`)

- Remove the `live`/`past` `Tabs`, the `IndexData` usage, and the
  `useIndexQuery` call.
- Drive the page from `useRealtimeQuery()`. Render `data.live` as a
  `VideoCard` grid (same grid breakpoints as today).
- `validateSearch` is removed (no `?tab` param). Existing links that
  still carry `?tab=` are ignored and resolve to the Live view by design
  (see §3, "Legacy `/?tab=…` links").
- **Loading:** reuse the existing skeleton grid.
- **Empty (`live: []`):** centered "No live streams right now".
- **Error:** `NotFoundError` → `warning` alert "No realtime data
  found"; other errors → the existing retry `error` alert.
- `useDocumentTitle("VChat")` unchanged.

### 6.4 Upcoming route (`src/routes/upcoming.tsx`, new)

- Data from `useUpcomingQuery()`.
- Two stacked sections, each a section heading + `VideoCard` grid:
  1. **Recently Started** → `data.recentlyStarted`
  2. **Scheduled** → `data.upcoming`
- Each section shows its own empty note when its array is empty
  ("No recently started streams" / "No scheduled streams"). If both are
  empty, both notes show.
- **Loading:** shared skeleton grid (same as the index route).
- **Error:** `NotFoundError` → `warning` alert "No upcoming data found";
  other errors → the existing retry `error` alert. (Same treatment as
  the index route, with upcoming-specific wording.)
- `useDocumentTitle("Upcoming — VChat")`.

### 6.5 Daily route (`src/routes/daily.$date.tsx`, new)

- Route param `$date` is the literal `"today"` or a `YYYY-MM-DD` string.
  A param is treated as not-found (render the `NotFound` component / an
  equivalent message, **no fetch issued**) unless it is `"today"` or it
  passes **semantic** date validation, not just the `^\d{4}-\d{2}-\d{2}$`
  shape. A helper `isValidYmd(s: string): boolean` checks both:
  - **Shape:** matches `^\d{4}-\d{2}-\d{2}$`.
  - **Real calendar date:** the parsed `year`/`month`/`day` round-trip
    through `Date.UTC(y, m-1, d)` unchanged (rejects impossible dates
    such as `2026-99-99`, `0000-00-00`, `2026-02-30`).
  - **Not in the future:** the date is `≤ todayYmdInTokyo()` (lexical
    compare on zero-padded strings). Future dates are not-found without a
    network request — daily files never exist ahead of today, and this
    matches the `›`-disabled-at-today boundary (the date switcher
    below). This
    guards direct links, stale bookmarks, and crawlers from issuing
    nonsense fetches that would otherwise 404 into a misleading "No data
    for this date".
- `validateSearch`:

  ```ts
  z.object({
    sort: z.enum(["availableAt", "maxViewers", "likes"]).default("availableAt"),
  })
  ```

- Data + resolved date from `useDailyVideosQuery($date)`.
- **In-page controls** (a header row above the list):
  - **Date switcher:** `‹  {resolvedDate}  ›`.
    - `‹` navigates to `/daily/{addDaysYmd(resolvedDate, -1)}` (a
      concrete date), preserving the current `sort`.
    - `›` navigates to `/daily/{addDaysYmd(resolvedDate, +1)}`,
      preserving `sort`, but is **disabled/hidden when
      `resolvedDate >= todayYmdInTokyo()`** (no navigation into the
      future). Comparison is lexical string comparison, valid for
      zero-padded `YYYY-MM-DD`.
    - The `today` alias keeps the URL as `/daily/today`; its `‹` resolves
      to the concrete previous day.
  - **Sort switcher:** a `ToggleButtonGroup` with three options —
    "Time" (`availableAt`), "Max Viewers" (`maxViewers`), "Likes"
    (`likes`). Selecting one calls
    `navigate({ search: { sort }, replace: true })`.
- **Client-side sort** of `data.videos` (the file's default order is
  `availableAt` desc; the SPA re-sorts per the selected sort):
  - `availableAt`: descending (newest first).
  - `maxViewers`: descending by `maxViewers`; entries with a missing
    `maxViewers` sort last.
  - `likes`: descending by `likes`; entries with a missing `likes` sort
    last.
  - Ties in every mode are broken by ascending `id` for a stable order.
  - Sorting is done on a shallow copy (no mutation of query data).
- **States:**
  - Loading → shared skeleton.
  - `data.videos: []` (200) → "No streams started this day".
  - `NotFoundError` → "No data for this date" (for `today`, this only
    appears after both today and yesterday 404).
  - Other errors → retry alert.
- **Stale-fallback notice.** When the route was requested as `today` but
  the query resolved via the yesterday fallback (`$date === "today"` and
  `resolvedDate !== todayYmdInTokyo()`), the page renders a visible
  informational note above the list — e.g. "Today's list isn't available
  yet — showing {resolvedDate}." plus a **Retry** control that calls
  `query.refetch()`. This keeps the fallback from being silently
  presented as today's ranking (the date switcher already shows the
  concrete `resolvedDate`, and this note names the reason). Recovery is
  user-driven (Retry, or navigating away and back per §5.3's
  `staleTime: 0`); there is deliberately **no** background timer, to
  honor the no-polling Non-goal. A clean today result shows no note.
- `useDocumentTitle` reflects the resolved date, e.g.
  `` `${resolvedDate} — VChat` ``.

### 6.6 Route registration

New files live under `src/routes/` and are picked up by `tsr generate`.
`src/routeTree.gen.ts` is regenerated by the build/typecheck scripts and
is never hand-edited.

## 7. Video-card / header display additions

### 7.1 Metrics row (`src/components/MetricsRow.tsx`, new)

- Rendered directly beneath the `StatusText` output in both `VideoCard`
  (list surfaces) and `VideoHeader` (video page). `StatusText` itself is
  unchanged.
- **Always renders all three metrics**, regardless of live/past status.
  A missing value renders as an em dash `—`; a present value renders as
  `value.toLocaleString()`.
- Each metric is an icon + number, with a MUI `Tooltip` supplying the
  label (the visible UI carries no text label — the tooltip replaces
  it). **Icons are Material Icons from `@mui/icons-material`; no
  emoji.**

  | Metric | Icon | Tooltip |
  | --- | --- | --- |
  | `viewers` | `VisibilityIcon` | "Current viewers" |
  | `maxViewers` | `TrendingUpIcon` | "Peak concurrent viewers" |
  | `likes` | `ThumbUpIcon` | "Likes" |

- Layout: a horizontal `Stack` with small spacing; icons sized to match
  the surrounding caption text. Wrapping is allowed on narrow cards.

### 7.2 Thumbnail badge (`src/components/ThumbnailBadge.tsx`, new)

A YouTube-style badge overlaid on the **`VideoCard` thumbnail only**
(the video page's `VideoHeader` is out of scope for this badge). It is
positioned absolutely in the bottom-right corner of the existing
thumbnail `Box` (which is already `position: relative`), mirroring the
placement pattern of the current top-left "Legacy" `Chip`. The badge is
display-only with `pointer-events: none`, so clicks fall through to the
card's overlay link (it must not be placed inside a new stacking context
that would trap those clicks).

**Content and style, decided by status:**

| Condition | Label | Style |
| --- | --- | --- |
| `status === "live"` and `premiere === true` | `"Premiere"` | red background, white text |
| `status === "live"` and `actualStart` present | live elapsed timer, `formatDuration(elapsedSeconds)`, **updating every second** | red background, white text |
| `status === "live"` and `actualStart` absent | `"Live"` | red background, white text |
| `status === "past"` or `"missing"`, and `duration > 0` | `formatDuration(duration)` | black (semi-opaque) background, white text |
| anything else (`upcoming` / `new`, or ended with no `duration`) | — | no badge rendered |

- **Precedence within `live`:** `premiere` wins over the elapsed timer,
  which wins over the `"Live"` fallback (evaluate in that order).
- **Live elapsed timer:** `elapsedSeconds = floor((now - Date.parse(actualStart)) / 1000)`,
  clamped to `≥ 0` (guards clock skew / a future `actualStart`, which
  render `"0:00"`). Only this variant subscribes to the shared clock
  (§7.3); the "Premiere", "Live", and past-duration variants are static
  and never start a timer.
- The red uses the theme error color (consistent with `StatusText`'s
  live styling); the past badge uses a semi-opaque black overlay so it
  reads over any thumbnail.

### 7.3 Shared 1-second clock (`src/lib/useNowTick.ts`, new)

To drive the live elapsed timer without one `setInterval` per card, add
a shared clock built on `useSyncExternalStore` (the same idiom as
`src/lib/settings.ts`):

- A module-level store holds `Date.now()` and a `Set` of listeners. A
  single `setInterval(…, 1000)` starts when the first listener
  subscribes and is cleared when the last one unsubscribes — so **no
  interval runs while no live-elapsed badge is mounted.**
- `useNowTick(): number` subscribes a component and returns the current
  epoch-ms snapshot, re-rendering it once per second.
- `ThumbnailBadge` calls `useNowTick()` **only** in the live-elapsed
  branch (via a small child component or a guarded hook usage) so that
  static badges do not subscribe. Each subscribed badge re-renders each
  second; with the handful of concurrently-live cards this is
  negligible, and the index grid is not virtualized so there is no
  measurement interaction.
- Elapsed time is derived purely from epoch milliseconds, so it is
  timezone-independent and unaffected by the timezone preference.

## 8. Error handling and edge cases (summary)

- **realtime / upcoming:** 404 → `warning` alert ("No realtime data
  found" / "No upcoming data found", per §6.3 / §6.4); non-404 → retry
  `error` alert. These files are expected to always exist, but the reader
  is defensive.
- **daily `today`:** today 404 → fetch yesterday; yesterday also 404 →
  "No data for this date".
- **daily concrete date:** 404 → "No data for this date";
  `videos: []` → "No streams started this day".
- **daily invalid `$date`:** treated as not-found; no fetch.
- **Metric absent:** rendered as `—`.
- **Thumbnail badge:** live + `premiere` → "Premiere"; live +
  `actualStart` → ticking elapsed timer; live without `actualStart` →
  "Live"; past/missing with `duration > 0` → formatted duration;
  otherwise no badge. A future/clock-skewed `actualStart` clamps the
  elapsed timer to `"0:00"`.
- **`›` at today:** disabled/hidden; no future navigation.
- **Unknown extra fields in any payload:** ignored (forward
  compatibility).

## 9. Dead-code cleanup

Performed as part of this change (the index route stops using it):

- Remove `IndexData` from `src/api/types.ts`.
- Remove `useIndexQuery` from `src/api/queries.ts`.
- Remove the now-unused `Tabs` / `Tab` imports and `?tab` search schema
  from the index route.

No other route reads `index.json`; `channels/$channelId` uses
`channels/{id}.json` and is untouched.

## 10. Verification

Per §3, there is no automated test harness. Before completion:

1. `npm run typecheck` passes (includes `tsr generate`).
2. `npm run lint` passes.
3. `npm run build` succeeds.
4. Manual exercise against a data source (`VITE_DATA_PROXY`):
   - `/` shows live streams from `realtime.json`; empty state when none.
   - `/upcoming` shows both sections; per-section empty notes.
   - `/daily/today` resolves the JST day, falls back to yesterday on a
     today 404, and the `‹ ›` switcher + sort toggle update the URL and
     list. `›` is unavailable at today.
   - `/daily/{YYYY-MM-DD}` for a concrete past date shows that day; a
     date with no file shows "No data for this date".
   - Sidebar navigation highlights the active entry; the two ranking
     entries highlight only on `/daily/today` with the matching `sort`.
   - Metrics row renders all three icons with tooltips on cards and the
     video header; `—` for missing values.
   - Thumbnail badge: a live stream with `actualStart` shows a red
     badge whose timer increments each second; a live premiere shows
     "Premiere"; a live stream without `actualStart` shows "Live"; an
     ended stream shows its formatted duration on a black badge; an
     upcoming stream shows no badge. The badge does not intercept card
     clicks.
   - Mobile: hamburger opens/closes the temporary drawer; desktop shows
     the permanent drawer.
