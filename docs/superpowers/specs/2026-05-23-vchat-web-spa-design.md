# vchat-web SPA — Design Spec

Date: 2026-05-23
Topic: A new React SPA (`vchat-web`) that consumes the JSON/JSONL artifacts
produced by honeybee's `chats-archive` component (see honeybee spec
`2026-05-10-chats-archive-jsonl-output-design.md`) and replaces the three
existing server-rendered HTML pages (index, channel, video) with a dynamic
client-rendered UI.

---

## 1. Scope

### In scope

- A React 19 + Vite + TypeScript SPA that renders three pages, all consuming
  JSON/JSONL produced by honeybee under `data/`:
  - **Index page** (`/`) — replaces `index.html`. Two tabs (Live/Upcoming,
    Past) of video cards. Source: `data/index.json`.
  - **Channel page** (`/channels/:channelId`) — replaces
    `{channelId}/index.html`. Channel header + grid of video cards.
    Source: `data/channels/{channelId}.json`.
  - **Video page** (`/videos/:videoId`) — replaces
    `{channelId}/{date}_{videoId}.html`. Video header, aggregates,
    filter chips, virtualized chat list. Source:
    `data/videos/{videoId}.meta.json` + `data/videos/{videoId}.jsonl`.
- Top-bar navigation with logo, breadcrumb, timezone toggle, theme toggle.
- GitHub Actions workflow that builds the SPA and deploys to AWS S3 root
  via OIDC, leaving the honeybee-owned `data/` subtree untouched.
- Legacy fallback: for videos whose `archiveVersion < 2`, the SPA's
  `VideoCard` links out to the existing static `.html` file in a new tab
  rather than navigating to the SPA video page.

### Out of scope

- The honeybee JSON/JSONL emission itself (already specified in
  `2026-05-10-chats-archive-jsonl-output-design.md`).
- AWS infrastructure setup (S3 bucket creation, CloudFront distribution,
  OIDC trust policy). The workflow consumes secrets that the user
  provisions once.
- i18n / localization. UI strings are English only.
- Internationalized timestamp formatting beyond timezone selection
  (Local / Asia/Tokyo / UTC).
- Service worker / offline / PWA shell.
- Full-text search across rows.
- Author channel pages (links from chat rows to author YouTube channels
  are not rendered).
- Deep links to a specific chat row within a video.
- Unit tests. Verification is manual (see §10).
- Backfill of historic videos (those with `archiveVersion < 2` keep
  linking to legacy HTML indefinitely; re-archiving is honeybee's
  responsibility).
- Web Worker offload for JSONL parsing. The parser lives behind a single
  function in `src/lib/jsonl.ts` so it can later be swapped for a worker
  without touching call sites; this spec does not implement the worker.
- Direct-load support for `/videos/:id` when the video is a legacy
  (`archiveVersion < 2`) record. Reaching the SPA video page is only
  supported by clicking a v2 card; direct-load of a v1 id will show
  the "archive not yet available" empty state (§6.4) since `meta.json`
  is absent. Users with a v1 bookmark must use the legacy HTML URL.

## 2. Tech stack (pinned)

| Concern | Choice |
| --- | --- |
| Build | Vite (latest) |
| Language | TypeScript |
| UI runtime | React 19+ |
| Routing | `@tanstack/react-router` (file-based) + `@tanstack/router-plugin/vite` |
| Data | `@tanstack/react-query` |
| Virtualization | `@tanstack/react-virtual` |
| UI library | Material UI v6+ (`@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`) |
| Search-param validation | `zod` |
| Package manager | npm |
| Node version | 24 (CI) |
| Hosting | AWS S3 (root) + CloudFront |

Bootstrap command (one-time, run in the empty repo):
`npm create vite@latest . -- --template react-ts`.

## 3. Repository layout

```
vchat-web/
├── public/                          # static assets bundled into dist root
├── src/
│   ├── main.tsx                     # bootstrap (providers + router)
│   ├── routeTree.gen.ts             # auto-generated; .gitignored (see note below)
│   ├── routes/                      # file-based routes
│   │   ├── __root.tsx               # TopBar layout + <Outlet /> + notFoundComponent
│   │   ├── index.tsx                # / — IndexPage
│   │   ├── channels.$channelId.tsx  # /channels/:channelId — ChannelPage
│   │   └── videos.$videoId.tsx      # /videos/:videoId — VideoPage
│   ├── api/
│   │   ├── client.ts                # fetch wrapper rooted at DATA_BASE
│   │   ├── queries.ts               # React Query hooks (one per artifact)
│   │   └── types.ts                 # TS types mirroring honeybee spec §2/§3/§4
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── VideoCard.tsx
│   │   ├── ChannelHeader.tsx
│   │   ├── VideoHeader.tsx
│   │   ├── CurrencyTable.tsx
│   │   ├── AggregatesSummary.tsx
│   │   ├── FilterChips.tsx
│   │   ├── ChatList.tsx             # virtualized list
│   │   └── chat-rows/
│   │       ├── ChatRow.tsx
│   │       ├── SuperChatRow.tsx
│   │       ├── SuperStickerRow.tsx
│   │       ├── MembershipRow.tsx
│   │       ├── MembershipGiftRow.tsx
│   │       ├── MembershipGiftPurchaseRow.tsx
│   │       ├── MilestoneRow.tsx
│   │       ├── PollRow.tsx
│   │       ├── RaidRow.tsx
│   │       └── RaidOutgoingRow.tsx
│   ├── lib/
│   │   ├── format.ts                # currency, timestamp, YouTube URL helpers
│   │   ├── jsonl.ts                 # parseJSONL(text): ChatRow[] + warnOnce
│   │   ├── settings.ts              # theme + timezone hook (localStorage)
│   │   └── useDocumentTitle.ts      # sets document.title per route
│   └── theme.ts                     # MUI light/dark themes
├── .github/workflows/deploy.yml
├── index.html
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── package.json
└── README.md
```

`routeTree.gen.ts` is generated at dev/build time by
`@tanstack/router-plugin/vite`. It is listed in `.gitignore` and is
referenced here only to document the import in `main.tsx`.

The honeybee-owned `data/` directory is never present in this repo. It
lives only on S3 (written by honeybee's separate sync job) and is fetched
at runtime from the same origin in production. For local dev, see §9.4.

## 4. Data layer

### 4.1 Types (`src/api/types.ts`)

TypeScript interfaces mirror honeybee's spec exactly. No transformation
between wire and app layer — types are the contract.

```ts
// Common author fields shared by chat/superChat/superSticker/membership/
// membershipGift/membershipGiftPurchase/milestone rows.
interface AuthorFields {
  id: string;
  timestamp: string;             // ISO 8601 from Date.toISOString() (UTC, Z-suffix)
  authorName?: string;
  authorPhoto?: string;
  authorChannelId: string;
  authorType: "owner" | "moderator" | "member" | "verified" | "other";
  membership?: string;
  isVerified: boolean;
  isOwner: boolean;
  isModerator: boolean;
}

interface ChatRowChat extends AuthorFields {
  type: "chat";
  message: string;
}

interface ChatRowSuperChat extends AuthorFields {
  type: "superChat";
  message: string | null;
  amount: number;
  currency: string;
  jpyAmount: number;
  significance?: number;
  color?: string;
}

interface ChatRowSuperSticker extends AuthorFields {
  type: "superSticker";
  text?: string;
  image: string;
  amount: number;
  currency: string;
  jpyAmount: number;
  significance?: number;
  color?: string;
}

interface ChatRowMembership extends AuthorFields {
  type: "membership";
  level?: string;
  since?: string;
}

interface ChatRowMembershipGift extends AuthorFields {
  type: "membershipGift";
  senderName?: string;
}

interface ChatRowMembershipGiftPurchase extends AuthorFields {
  type: "membershipGiftPurchase";
  amount: number;                // gift count
}

interface ChatRowMilestone extends AuthorFields {
  type: "milestone";
  message: string | null;
  level?: string;
  duration?: number;
  since?: string;
}

interface ChatRowPoll {
  type: "poll";
  id: string;
  timestamp: string;
  createdAt?: string;
  question?: string;
  choices: Array<{ text: string; voteRatio?: number }>;
  voteCount?: number;
}

interface ChatRowRaid {
  type: "raid";
  id?: string;
  timestamp: string;
  sourceVideoId?: string;
  sourceChannelId?: string;
  sourceName: string;
  sourcePhoto?: string;
}

interface ChatRowRaidOutgoing {
  type: "raidOutgoing";
  id?: string;
  timestamp: string;
  originVideoId: string;
  originChannelId?: string;
  originName?: string;
  originPhoto?: string;
}

type ChatRow =
  | ChatRowChat
  | ChatRowSuperChat
  | ChatRowSuperSticker
  | ChatRowMembership
  | ChatRowMembershipGift
  | ChatRowMembershipGiftPurchase
  | ChatRowMilestone
  | ChatRowPoll
  | ChatRowRaid
  | ChatRowRaidOutgoing;

interface ChannelRef {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface VideoStats {
  superChatTotalJpy: number;     // always present, default 0
  memberCount: number;           // always present, default 0
  giftCount: number;             // always present, default 0
}

// VideoStatus — enumerated from honeybee's holodex.js VideoStatus enum
// (lowercase strings as serialized into JSON). The SPA's status branches
// must cover every value in this set; any other string falls through to
// the `past` branch (render `availableAt`).
type VideoStatus = "new" | "upcoming" | "live" | "past" | "missing";

interface VideoSummary {
  id: string;
  title: string;
  channel: ChannelRef;
  status: VideoStatus;
  duration: number;
  availableAt: string;           // ISO 8601
  archiveVersion: number;        // 1 = legacy HTML only; 2 = JSON available
  stats: VideoStats;
  scheduledStart?: string;
  actualStart?: string;
  actualEnd?: string;
  publishedAt?: string;
}

// videos[] entries in ChannelData omit `channel` (channel is at top level).
type VideoSummaryWithoutChannel = Omit<VideoSummary, "channel">;

interface IndexData {
  live: VideoSummary[];
  past: VideoSummary[];
}

interface ChannelData extends ChannelRef {
  videos: VideoSummaryWithoutChannel[];
}

interface CurrencyAgg {
  currency: string;              // ISO 4217 code (e.g. "USD", "JPY")
  amount: number;
  jpyAmount: number;
}

interface VideoAggregates {
  chatCount: number;
  superChatCount: number;
  superStickerCount: number;
  membershipCount: number;
  giftCount: number;
  giftPurchaseCount: number;
  totalGiftAmount: number;
  milestoneCount: number;
  pollCount: number;
  raidCount: number;             // covers both `raid` and `raidOutgoing` rows
  currencyTable: CurrencyAgg[];
  jpyTotal: number;
}

// meta.json shape: VideoSummary + aggregates (no extra wrapper).
interface VideoMeta extends VideoSummary {
  aggregates: VideoAggregates;
}
```

Note on `VideoStatus`: honeybee surfaces the holodex.js `VideoStatus`
enum value verbatim. The values above are the complete set as of the
honeybee spec date. If a future status string appears, the SPA renders
it via the default `past` branch (see §6.4) and emits a `warnOnce`
console message (see §11).

### 4.2 Fetch wrapper (`src/api/client.ts`)

A single helper rooted at `DATA_BASE`. Same-origin in production, no
CORS, no auth. `DATA_BASE` is `import.meta.env.VITE_DATA_BASE ?? "/data"`
so local dev (§9.4) and prod can differ without code changes.

```ts
const DATA_BASE = import.meta.env.VITE_DATA_BASE ?? "/data";

export class NotFoundError extends Error {}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`, { cache: "default" });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchJsonl<T>(path: string): Promise<T[]> {
  const res = await fetch(`${DATA_BASE}${path}`, { cache: "default" });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  const text = await res.text();
  return parseJSONL<T>(text);
}
```

`parseJSONL` lives in `src/lib/jsonl.ts`:

```ts
import type { ChatRow } from "../api/types";

const KNOWN_TYPES = new Set<ChatRow["type"]>([
  "chat", "superChat", "superSticker", "membership",
  "membershipGift", "membershipGiftPurchase", "milestone",
  "poll", "raid", "raidOutgoing",
]);

const warned = new Set<string>();
export function warnOnce(label: string, detail: string): void {
  const key = `${label}:${detail}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[vchat] ${label}: ${detail}`);
}

export function parseJSONL<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const row = JSON.parse(line) as { type?: string };
    if (typeof row.type === "string" && !KNOWN_TYPES.has(row.type as ChatRow["type"])) {
      warnOnce("unknown row type", row.type);
      continue;                                            // drop unknown rows
    }
    out.push(row as T);
  }
  return out;
}
```

Isolating the parser behind this function preserves the future option of
swapping in a Web Worker without touching call sites.

### 4.3 Query hooks (`src/api/queries.ts`)

```ts
useIndexQuery(): UseQueryResult<IndexData>
  queryKey: ["index"]
  queryFn: () => fetchJson<IndexData>("/index.json")
  staleTime: 60_000
  gcTime: 5 * 60_000
  retry: (failureCount, error) => !(error instanceof NotFoundError) && failureCount < 3

useChannelQuery(channelId: string): UseQueryResult<ChannelData>
  queryKey: ["channel", channelId]
  queryFn: () => fetchJson<ChannelData>(`/channels/${channelId}.json`)
  staleTime: 60_000
  gcTime: 5 * 60_000
  retry: (failureCount, error) => !(error instanceof NotFoundError) && failureCount < 3

useVideoMetaQuery(videoId: string): UseQueryResult<VideoMeta>
  queryKey: ["videoMeta", videoId]
  queryFn: () => fetchJson<VideoMeta>(`/videos/${videoId}.meta.json`)
  staleTime: 5 * 60_000
  gcTime: 30 * 60_000
  retry: (failureCount, error) => !(error instanceof NotFoundError) && failureCount < 3

useVideoRowsQuery(videoId: string): UseQueryResult<ChatRow[]>
  queryKey: ["videoRows", videoId]
  queryFn: () => fetchJsonl<ChatRow>(`/videos/${videoId}.jsonl`)
  staleTime: 5 * 60_000
  gcTime: 30 * 60_000
  retry: (failureCount, error) => !(error instanceof NotFoundError) && failureCount < 3
```

Components never call `fetch` directly. On the video page `meta` and
`rows` fire in parallel (no dependency between them). 404 errors do
not retry (no point retrying a missing file).

## 5. Routing

### 5.1 Route table

| Path | File | Search params (validated by zod) |
| --- | --- | --- |
| `/` | `routes/index.tsx` | `{ tab: "live" \| "past" }` default `"live"` |
| `/channels/$channelId` | `routes/channels.$channelId.tsx` | none |
| `/videos/$videoId` | `routes/videos.$videoId.tsx` | `{ types?: FilterableType[]; minSig?: number }` where `type FilterableType = Exclude<ChatRow["type"], "raidOutgoing">` (`raidOutgoing` is grouped under `raid` per §5.2; never appears in the URL) |
| any other | `__root.tsx#notFoundComponent` | n/a |

Unknown search params are dropped silently (zod `.strip()` by default).
Per-field default semantics:

- `tab` (Index page) — `z.enum(["live","past"]).default("live")`.
  Schema-level default; no need to distinguish absence from a value.
- `types` (Video page) — `z.array(z.enum([...])).optional()` (the
  enum is the 9-value `FilterableType` set defined in §5.1). No
  schema-level default. The component applies
  `["superChat","superSticker"]` only when the field is `undefined`,
  so `?types=` (explicit empty array, post-decode) keeps the empty
  list semantics described below for `types`.
- `minSig` (Video page) — `z.number().int().min(0).max(7).optional()`.
  Component applies default `1` when `undefined`.

`__root.tsx` declares `notFoundComponent: () => <NotFound />` which
renders a centered `Typography` + a `Button` back to `/`. The same
component is also used for unmatched paths globally.

### 5.2 Search-param semantics on video page

- `types` — array of row types to show. Valid values: `chat`,
  `superChat`, `superSticker`, `membership`, `membershipGift`,
  `membershipGiftPurchase`, `milestone`, `poll`, `raid`. Selecting
  `raid` also shows `raidOutgoing` rows (the `raid` chip controls both
  directions; there is no separate `raidOutgoing` chip).
  - Absent (`undefined`): defaults to `["superChat", "superSticker"]`.
  - Explicit empty list (`[]`): show no rows. The UI renders the
    "No row types selected" empty state (§6.4 #5).
- `minSig` — integer `0..7`. Only filters `superChat` and `superSticker`
  rows; other types are unaffected. A row with no `significance` field
  is treated as significance `0`.
  - Absent: defaults to `1`.

### 5.3 URL serialization

Search params use TanStack Router's **default** JSON-string serializer
(no custom `parseSearch` / `stringifySearch` override). Arrays serialize
as JSON-encoded strings in the query string:
`?types=%5B%22superChat%22%2C%22superSticker%22%5D&minSig=1`. URLs are
not pretty but are fully shareable and round-trip safe.

Filter changes call `navigate({ search: ..., replace: true })` so
back/forward history is not polluted on every chip toggle.

### 5.4 CloudFront SPA rewrite

CloudFront must rewrite requests for SPA paths to `/index.html` so the
client-side router can handle them, while leaving `/data/*`,
`/assets/*`, and any legacy file requests (paths with a `.` in the
last segment) untouched — so `fetchJson` in §4.2 can distinguish a
missing JSON file from a real response, and legacy HTML files keep
serving directly.

AWS's distribution-level **Custom error responses** apply to all
behaviors and cannot be scoped per-path-prefix; therefore the
"separate cache behavior" approach does not work for selectively
suppressing the SPA rewrite on `/data/*`. The supported approach is
a **CloudFront Function on `viewer-request`** that performs the rewrite
selectively in JavaScript.

**Setup (one-time, by the operator, outside this repo):**

1. CloudFront → Functions → Create function:
   - Name: `spa-rewrite`
   - Runtime: `cloudfront-js-2.0`
   - Code:

     ```js
     function handler(event) {
       var request = event.request;
       var uri = request.uri;

       // Pass through real file paths: SPA assets, honeybee data,
       // and any URI whose last segment contains a "." (legacy
       // /{channelId}/{date}_{id}.html and /{channelId}/index.html).
       if (uri.startsWith('/data/') || uri.startsWith('/assets/')) {
         return request;
       }
       var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
       if (lastSegment.indexOf('.') !== -1) {
         return request;
       }

       // Everything else is an SPA route (including unknown paths
       // that should render the NotFound page). Rewrite to index.html.
       request.uri = '/index.html';
       return request;
     }
     ```

2. Publish the function (Publish tab → Publish function).
3. Distribution → Default behavior → Edit → Function associations →
   Viewer request → select `spa-rewrite` (CloudFront Functions). Save.
4. Default behavior's **Custom error responses** are left empty — the
   function rewrites SPA URIs before they hit origin, so SPA paths
   return 200 from origin directly. `/data/*` and `/assets/*` real
   files keep their natural 200/404 from origin.

**Resulting behavior:**

- `/data/videos/UNKNOWN.meta.json` → origin 404 → client 404 →
  `NotFoundError` → "Archive not yet available" UI.
- `/videos/abc` → rewritten to `/index.html` → 200 → SPA bootstraps
  into the video page.
- `/garbage` → rewritten to `/index.html` → SPA's `NotFound` page.
- `/UCxxx/20260101_abc.html` (legacy HTML) → has `.` in last segment
  → passed through to origin → real 200 (if file exists) or 404.

The CloudFront invalidation in §9.3 explicitly never targets `/data/*`.

## 6. Page-by-page UX

### 6.1 TopBar (rendered on all pages)

Single `AppBar position="sticky"` with `Toolbar`:

- Left: `VChat` title (text logo), clickable → `/`.
- Middle (grows): MUI `Breadcrumbs`. Derived from `useMatches()`:
  - `/` → `Home`
  - `/channels/:id` → `Home / {channel.name}` (channel name from
    `useChannelQuery`; placeholder `…` while loading)
  - `/videos/:id` → `Home / {channel.name} / {video.title}` (truncated
    with ellipsis; channel name and title from `useVideoMetaQuery`)
- Right: timezone select (`IconButton` with `AccessTimeIcon` opening a
  `Menu` with `Local`, `Asia/Tokyo`, `UTC`) + theme select (`IconButton`
  with `Brightness4Icon` opening a `Menu` with `Light`, `Dark`,
  `System`). Both persist in `localStorage` (keys `vchat:timezone`,
  `vchat:theme`).

Mobile: breadcrumb collapses to last crumb only when viewport <
`sm` breakpoint.

Document title is set per route by a `useDocumentTitle(text)` hook
(`src/lib/useDocumentTitle.ts`) wrapping a `useEffect` that writes
`document.title`:

- Index: `"VChat"`
- Channel: `"{channel.name} — VChat"` (or `"VChat"` while loading)
- Video: `"{video.title} — VChat"`
- NotFound: `"Not Found — VChat"`

### 6.2 Index page (`/`)

Layout:

1. `Tabs` with values `live` and `past`, controlled by URL search param
   `tab`. Labels: `Live / Upcoming ({live.length})`,
   `Past ({past.length})`.
2. `Grid container spacing={2}` with `VideoCard` children
   (`Grid xs={12} sm={6} md={4} lg={3}`). Cards render with the
   default `hideChannel: false` so each shows its channel chip.

States:

- Loading: 8 `Skeleton` cards.
- Error (non-404): `Alert severity="error"` with retry `Button`
  calling `refetch()`.
- NotFound (404 on `index.json`): `Alert severity="warning"` with text
  "No archive index found".
- Empty tab: centered `Typography color="text.secondary"`:
  `"No live streams"` or `"No past archives"`.

### 6.3 Channel page (`/channels/:channelId`)

Layout:

1. `ChannelHeader`: `Avatar src={avatarUrl}` 64×64 circular + channel
   name `Typography variant="h4"` + external link `IconButton` →
   `https://www.youtube.com/channel/{channelId}` (new tab).
2. `Grid` of `VideoCard`s, with `hideChannel={true}` since the channel
   header above already establishes context. Each card is built from
   a `VideoSummaryWithoutChannel` entry. The `VideoCard` component
   accepts a `channel: ChannelRef` prop separately so it can compute
   `legacyVideoHref` and render the chip when not hidden; on this page
   the channel value is the page-level `ChannelData` (id + name +
   avatarUrl) passed once per card.

States: loading shows 8 `Skeleton` cards (header has its own
`Skeleton`). Error (non-404) same as Index. NotFound (404 on
`channels/{id}.json`): `Alert severity="warning"` "Channel not found".

### 6.4 Video page (`/videos/:videoId`)

Layout (vertical stack inside `Container maxWidth="lg"`):

#### 1. VideoHeader

- Thumbnail (left, 240px wide, 16:9, `loading="lazy"`,
  `referrerPolicy="no-referrer"`), clickable →
  `https://youtu.be/{videoId}` (new tab). Thumbnail URL:
  `https://i.ytimg.com/vi/{videoId}/mqdefault.jpg` (also used by
  `VideoCard`; centralize in `getYouTubeThumbnail(id)` in
  `src/lib/format.ts`).
- Title (`Typography variant="h5"`, clickable → same URL).
- Channel chip (`Avatar` + name) clickable → `/channels/{channelId}`.
- Status line via `<StatusText status video />`:

  | status | rendered text |
  | --- | --- |
  | `upcoming` | `"Start at {scheduledStart}"` when `scheduledStart` is defined, else `"Upcoming"` |
  | `live` | `"Live since {actualStart}"` (red) when `actualStart` is defined, else `"Live Now"` (red) |
  | `past` | `"Published at {availableAt}"` |
  | `missing` | `"Published at {availableAt}"` (same as `past`) |
  | `new` | `"Upcoming"` |
  | any other string | `"Published at {availableAt}"` (default branch); `warnOnce("unknown status", status)` |

  All rendered timestamps use the user's selected timezone.

#### 2. CurrencyTable

Compact MUI `Table` with monospace cells, right-aligned numerics.
Columns:

| code | sum | sum (JPY) |
| --- | --- | --- |

Body: one row per `meta.aggregates.currencyTable[]` entry — `code` =
`row.currency`; `sum` = `formatCurrency(row.amount, row.currency,
"decimal")`; `sum (JPY)` = `formatCurrency(Math.round(row.jpyAmount),
"JPY", "decimal")`. Final row: blank `code`, blank `sum`, JPY total
(`meta.aggregates.jpyTotal`).

The `symbol` column from the legacy HTML is omitted because the upstream
`CurrencyAgg` does not carry a symbol field and deriving one cleanly
across all currencies adds complexity for marginal value. The
`code` column already disambiguates.

#### 3. AggregatesSummary

Single row of MUI `Chip`s (read-only, not toggleable; for display only).
Each chip is `Chip label="{Label}: {count}"` with counts formatted via
`toLocaleString()`. One chip per entry in the table below; order is
the table order. Labels here are the canonical labels also used by
FilterChips (§6.4 #4) — same field, same label across the page.

| Chip label | source field |
| --- | --- |
| Chat | `aggregates.chatCount` |
| SuperChat | `aggregates.superChatCount` |
| SuperSticker | `aggregates.superStickerCount` |
| Member | `aggregates.membershipCount` |
| Gifts Received | `aggregates.giftCount` |
| Gift Purchases | `aggregates.giftPurchaseCount` |
| Total Gifts | `aggregates.totalGiftAmount` |
| Milestone | `aggregates.milestoneCount` |
| Poll | `aggregates.pollCount` |
| Raid | `aggregates.raidCount` |

Note: `Total Gifts` has no FilterChips equivalent (it is a derived sum,
not a row-type count); it appears only in this summary.

#### 4. FilterChips

- Row of nine toggleable MUI `Chip`s, one per filterable type. Each
  chip is `Chip label="{Label} ({count})"` with `color="primary"`
  when selected, `variant="outlined"` otherwise. Counts come from
  `meta.aggregates.*` per the mapping below:

  | Chip key | UI label | count source |
  | --- | --- | --- |
  | `chat` | `Chat` | `aggregates.chatCount` |
  | `superChat` | `SuperChat` | `aggregates.superChatCount` |
  | `superSticker` | `SuperSticker` | `aggregates.superStickerCount` |
  | `membership` | `Member` | `aggregates.membershipCount` |
  | `membershipGift` | `Gifts Received` | `aggregates.giftCount` |
  | `membershipGiftPurchase` | `Gift Purchases` | `aggregates.giftPurchaseCount` |
  | `milestone` | `Milestone` | `aggregates.milestoneCount` |
  | `poll` | `Poll` | `aggregates.pollCount` |
  | `raid` | `Raid` | `aggregates.raidCount` |

  The `raid` chip controls both `raid` and `raidOutgoing` rows (per
  §5.2). `raidCount` already covers both directions.

- Below the chip row: MUI `Slider` (`min=0`, `max=7`, `step=1`, marks
  at every integer) labeled
  `"Min significance (SuperChat / Sticker)"`.

#### 5. ChatList (see §7)

If `selectedTypes.length === 0` (user deselected all chips), the list
area (§6.4 #5) renders centered `Typography color="text.secondary"`:
`"No row types selected"`. The virtualizer is not mounted.

#### Error / loading states

- Either `meta` or `rows` loading: full-page `Skeleton` block (header,
  table, chips, ten row-skeletons).
- `meta` error, non-404: `Alert severity="error"` + retry.
- `meta` 404 (`NotFoundError`): `Alert severity="warning"` titled
  `"Archive not yet available"`. Body text: "This video has not yet
  been archived in the new format. If you have an older link, the
  legacy archive may be available." No legacy-HTML link is rendered
  on this page because the channelId and `availableAt` needed to
  compute the legacy URL are not available without `meta.json`
  (per the out-of-scope note in §1).
- `rows` error, non-404: render header + meta + chips as normal; show
  error `Alert` + retry inside the list area only.
- `rows` 404 while `meta` succeeds: render header + meta + chips as
  normal; show empty-state `Typography color="text.secondary"`:
  `"No chat rows archived for this video"` inside the list area.
- `meta.archiveVersion < 2` while `meta` somehow returns 200
  (defensive — honeybee bumps the version atomically with file
  creation): full-page `Alert severity="warning"` with a "Open legacy
  archive" `Button` linking to `legacyVideoHref(meta)` in a new tab.

### 6.5 VideoCard layout (used by §6.2 and §6.3)

`VideoCard` props:

```ts
interface VideoCardProps {
  video: VideoSummary | VideoSummaryWithoutChannel;
  channel: ChannelRef;            // always provided; on channel page = page-level channel
  hideChannel?: boolean;          // default false
}
```

MUI `Card` content (top to bottom):

1. Thumbnail wrapper (`CardActionArea` for the click target):
   - `img` 16:9 at `getYouTubeThumbnail(video.id)`, `loading="lazy"`,
     `referrerPolicy="no-referrer"`.
   - If `video.archiveVersion >= 2`: wrapper is a TanStack Router
     `<Link to="/videos/$videoId" params={{ videoId: video.id }} />`.
   - If `video.archiveVersion < 2`: wrapper is `<a target="_blank"
     rel="noopener noreferrer" href={legacyVideoHref(video, channel)}>`.
     A `Chip label="Legacy" size="small" color="default"` is overlaid
     in the top-left of the thumbnail (`position: absolute`).
2. Body:
   - Title: `Typography variant="subtitle1"` with 2-line clamp
     (`-webkit-line-clamp: 2`). Clickable; same target rule as
     thumbnail (router link for v2, plain `<a>` for v1).
   - When `!hideChannel`: channel chip below title — `Avatar` 24×24 +
     channel name `Typography variant="body2"`. Clickable →
     `/channels/{channel.id}` via TanStack Router (regardless of
     `archiveVersion`; channel page reachability is independent of
     video version).
   - Status: `<StatusText status video />` (see §6.4 #1). For card
     context, render as `Typography variant="caption"
     color="text.secondary"`.
3. Footer (`CardActions` or styled `Box`):
   - Single line: `SC: {formatCurrency(stats.superChatTotalJpy,
     "JPY")} · Members: {stats.memberCount.toLocaleString()} ·
     Gifts: {stats.giftCount.toLocaleString()}`.

`legacyVideoHref` signature (defined in §8):
`legacyVideoHref(video: { id: string; availableAt: string }, channel:
{ id: string }): string`.

## 7. Chat list rendering

### 7.1 Filtering

Filtering is pure-client. The full row array from `useVideoRowsQuery` is
passed through `useMemo`:

```ts
const filtered = useMemo(() => {
  const typeSet = new Set(selectedTypes);
  const raidGroup = typeSet.has("raid");
  return rows.filter((row) => {
    if (row.type === "raidOutgoing") return raidGroup;
    if (!typeSet.has(row.type)) return false;
    if (row.type === "superChat" || row.type === "superSticker") {
      return (row.significance ?? 0) >= minSig;
    }
    return true;
  });
}, [rows, selectedTypes, minSig]);
```

Filter operations on a 50k-row array run in ~5ms on commodity hardware;
no further optimization in this spec.

### 7.2 Virtualization

`@tanstack/react-virtual` `useVirtualizer` over the `filtered` array.
Configuration:

- `count: filtered.length`
- `getScrollElement: () => scrollRef.current`
- `estimateSize: () => 64` (rows are variable height; initial estimate;
  the virtualizer measures actual heights via `measureElement`)
- `overscan: 8`

Container structure (verbatim shape required for measurement to work):

```tsx
const scrollRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({ ...config });

<Box ref={scrollRef} sx={{ height: "var(--chatlist-height)", overflow: "auto" }}>
  <Box sx={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
    {virtualizer.getVirtualItems().map((item) => (
      <Box
        key={item.key}
        data-index={item.index}
        ref={virtualizer.measureElement}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${item.start}px)`,
        }}
      >
        <RowDispatcher row={filtered[item.index]} no={item.index + 1} ... />
      </Box>
    ))}
  </Box>
</Box>
```

`--chatlist-height` is the CSS custom property set by the video page:
the page mounts a `ResizeObserver` on the block containing
`VideoHeader + CurrencyTable + AggregatesSummary + FilterChips`,
measures its rendered height `H`, and writes
`--chatlist-height: calc(100vh - var(--topbar-h) - ${H}px - var(--chatlist-pad))`
on the `Container` element. `--chatlist-pad` is a constant defined in
`theme.ts` (default `16px`) representing the desired bottom gap between
the virtualized list and the viewport edge; it lives in one place so a
future layout change updates it everywhere. `--topbar-h` is set once by
`TopBar` on mount via the same `ResizeObserver` pattern. This avoids
hard-coding header heights while still giving the virtualizer a stable
scroll container.

### 7.3 Row components

Ten components under `src/components/chat-rows/`, dispatched by `type`
via a small `RowDispatcher` (switch on `row.type`). Each receives
`{ row, no, video, timezone }` (where `video: VideoMeta`) and renders
into a shared CSS grid layout:

```css
display: grid;
grid-template-columns: 56px 180px 56px 200px 1fr;
grid-template-areas: "no ts photo author body";
align-items: center;
column-gap: 8px;
padding: 8px 12px;
border-bottom: 1px solid divider;
```

All 10 row types render into all 5 grid cells; no cell spans across
columns. For `poll`, `raid`, and `raidOutgoing` rows (which have no
chat-author) the `photo` cell renders empty and the `author` cell
renders the role label per the per-type table below (`"Poll"`,
`"Raid (incoming)"`, `"Raid (outgoing)"`). This keeps every row
aligned under the same grid regardless of type.

Per-row content:

| Column | Cell content |
| --- | --- |
| no | running index within `filtered` (renumbers from 1 on every filter change; **not** the absolute row index from the legacy HTML), right-aligned |
| ts | `<TimestampLink row video timezone />` (§7.4) |
| photo | `Avatar src={authorPhoto}` 40×40, `loading="lazy"`, `referrerPolicy="no-referrer"` |
| author | `Typography variant="body2"` author name |
| body | type-specific (table below) |

Type-specific `body` cell:

| Type | Body |
| --- | --- |
| `chat` | `row.message`, with a leading `borderLeft: 4px solid {color}` chosen by branching on `row.authorType` in this order — `owner` → green, `moderator` → blue, `verified` → grey, anything else → no border. Branching on `authorType` (not the boolean flags) ensures exactly one classification per row. |
| `superChat` | left badge (`Box` 40px height, `bgcolor={row.color ?? "transparent"}`) + amount text (see below) + message (italic `(wordless superchat)` placeholder when `message` is null) |
| `superSticker` | left badge + amount text + `<img src={row.image} alt={row.text ?? "sticker"} title={row.text ?? ""}>` |
| `membership` | green left chip + `"Joined as a member ({row.level ?? row.membership ?? "N/A"})"` |
| `membershipGift` | green left chip + `"Received a membership gift from {row.senderName ?? "N/A"}"` |
| `membershipGiftPurchase` | green left chip + `"Purchased {row.amount} membership gift(s)"` |
| `milestone` | green left chip + (`row.message` or italic `(wordless milestone)`) |
| `poll` | author column shows `"Poll"`; body: optional `"{voteCount} votes"` line, question (or `"(empty question)"`), then one line per choice: `"- {text} ({voteRatio*100 to 1 dp}%)"` (omit `(xx.x%)` when `voteRatio` is undefined) |
| `raid` | author column shows `"Raid (incoming)"`; body: `"{row.sourceName} and their viewers just joined. Say hello!"` |
| `raidOutgoing` | author column shows `"Raid (outgoing)"`; body: `"Sending you to {row.originName ?? ""}"` |

Amount text format for `superChat` / `superSticker`:

```ts
row.currency === "JPY"
  ? formatCurrency(row.jpyAmount, "JPY")
  : `${formatCurrency(row.amount, row.currency)} (${formatCurrency(row.jpyAmount, "JPY")})`
```

### 7.4 Timestamp display

`<TimestampLink row video timezone />` renders the timestamp text using
`formatTimestamp(row.timestamp, timezone)`.

Linking logic: both `row.timestamp` and `video.actualStart` are produced
by honeybee via `Date.toISOString()` (UTC, `Z`-suffixed) per the
honeybee spec §3, so lexicographic string compare is equivalent to
chronological compare. No `Date` construction is needed for the gating
check.

```ts
if (video.actualStart && row.timestamp >= video.actualStart) {
  const t = Math.floor(
    (Date.parse(row.timestamp) - Date.parse(video.actualStart)) / 1000
  );
  // wrap in <a target="_blank" rel="noopener noreferrer"
  //          href={getYouTubeUrl(video.id, t)}>
} else {
  // render plain text
}
```

## 8. Helpers (`src/lib/format.ts`)

```ts
// Currency code → fraction digits. Subset covering currencies that
// commonly appear in YouTube SuperChat data; default 2 when unknown.
const currencyDigits: Record<string, number> = {
  JPY: 0, KRW: 0, CLP: 0, VND: 0,
  USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, HKD: 2, TWD: 2, SGD: 2,
  THB: 2, PHP: 2, IDR: 2, MXN: 2, BRL: 2, ARS: 2, INR: 2, RUB: 2,
  PLN: 2, SEK: 2, NOK: 2, DKK: 2, CHF: 2, NZD: 2, ZAR: 2, TRY: 2,
  CZK: 2, HUF: 2, ILS: 2, MYR: 2, RON: 2, PEN: 2, COP: 2, CRC: 2,
  // ...extend as needed; default branch below handles the rest
};

export function formatCurrency(
  amount: number,
  currency: string,
  style: "currency" | "decimal" = "currency",
): string {
  const digits = currencyDigits[currency] ?? 2;
  return amount.toLocaleString("en-US", {
    style,
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export type TimezonePref = "local" | "Asia/Tokyo" | "UTC";

export function formatTimestamp(iso: string, timezone: TimezonePref): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
    timeZone: timezone === "local" ? undefined : timezone,
  });
  // Reformat as "YYYY-MM-DD HH:mm:ss".
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function getYouTubeUrl(videoId: string, t?: number): string {
  return t != null
    ? `https://youtu.be/${videoId}?t=${t}`
    : `https://youtu.be/${videoId}`;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

// Always Asia/Tokyo regardless of user timezone preference, because
// honeybee's archive file naming uses Tokyo-local date.
export function ymdInTokyo(iso: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  return `${parts.year}${parts.month}${parts.day}`;
}

export function legacyVideoHref(
  video: { id: string; availableAt: string },
  channel: { id: string },
): string {
  return `/${channel.id}/${ymdInTokyo(video.availableAt)}_${video.id}.html`;
}
```

## 9. Build & deployment

### 9.1 Vite config (`vite.config.ts`)

- Plugins: `@vitejs/plugin-react`, `@tanstack/router-plugin/vite`.
- `base: "/"`.
- `build.target: "es2022"`.
- `build.outDir: "dist"`.
- Code-splitting per route is automatic (TanStack Router lazy routes).
- Devtools (`@tanstack/react-query-devtools`,
  `@tanstack/react-router-devtools`) mount only when
  `import.meta.env.DEV`.
- `server.proxy` for local dev (§9.4).

### 9.2 npm scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

### 9.3 GitHub Actions (`.github/workflows/deploy.yml`)

Triggers: `push` to `main`, plus `workflow_dispatch`.

Single job `deploy` on `ubuntu-latest` with:

```yaml
permissions:
  id-token: write
  contents: read
```

Steps:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 24`, `cache: 'npm'`
3. `npm ci`
4. `npm run lint`
5. `npm run typecheck`
6. `npm run build`
7. `aws-actions/configure-aws-credentials@v4`:
   - `role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}`
   - `aws-region: ${{ secrets.AWS_REGION }}`
8. `aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}/ --delete --exclude "data/*"`
   — `--delete` removes stale SPA assets; `--exclude "data/*"` ensures
   the honeybee-owned subtree is never touched even if a future build
   accidentally emits files under `data/`. AWS CLI's `*` wildcard in
   `--exclude` matches `/` characters, so `data/*` recursively excludes
   all paths under `data/` regardless of depth.
9. `aws cloudfront create-invalidation
   --distribution-id ${{ secrets.CF_DIST_ID }}
   --paths "/index.html" "/assets/*"`
   — invalidates only SPA paths; `/data/*` is never invalidated here
   (honeybee's sync job is responsible for its own cache busting).

Required GitHub secrets (provisioned by user out-of-band):
`AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET`, `CF_DIST_ID`.

If any of `lint`, `typecheck`, `build` fails, the deploy step does not
run (GitHub Actions default behavior on step failure).

### 9.4 Local development

`data/` is not present in this repo. Two options for local dev,
documented in `README.md`:

1. **Proxy to a remote** (default `npm run dev`): `vite.config.ts`
   declares `server.proxy = { "/data": { target:
   process.env.VITE_DATA_PROXY ?? "https://archive.example.com",
   changeOrigin: true } }`. Developers set `VITE_DATA_PROXY` in
   `.env.local` to point at any reachable archive host (e.g. the
   production CloudFront URL).
2. **Override `DATA_BASE` directly**: set `VITE_DATA_BASE` in
   `.env.local` to an absolute URL. `src/api/client.ts` reads
   `import.meta.env.VITE_DATA_BASE ?? "/data"` (§4.2). When set, the
   proxy is bypassed entirely and fetches go cross-origin (requires
   CORS on the target).

Sample `.env.local` (gitignored):

```bash
VITE_DATA_PROXY=https://archive.example.com
# or:
# VITE_DATA_BASE=https://archive.example.com/data
```

## 10. Verification (manual)

After deployment to a non-production S3 bucket pointed at a real
`data/` tree, perform the following checks:

1. Load `/`. Confirm Live/Upcoming and Past tabs render the same set
   of cards (same count, same order) as the legacy `/index.html`.
2. Toggle the Tabs; URL `?tab=` updates; browser back/forward navigates
   between tabs.
3. Click a card with `archiveVersion: 2`. Confirm SPA navigates to
   `/videos/:id` and the video page renders.
4. Click a card with `archiveVersion: 1` (legacy). Confirm a new tab
   opens to the legacy HTML at
   `/{channelId}/{YYYYMMDD}_{videoId}.html`. The current SPA tab does
   not navigate. The card shows a "Legacy" chip in the thumbnail.
5. On a video page, confirm `CurrencyTable` `code` / `sum` / `sum (JPY)`
   columns match the corresponding values in the legacy HTML's
   currency table (legacy has an extra `symbol` column; ignore that
   one).
6. Confirm `AggregatesSummary` chips in the §6.4 #3 canonical order
   (Chat, SuperChat, SuperSticker, Member, Gifts Received, Gift
   Purchases, Total Gifts, Milestone, Poll, Raid). For every chip
   **except** Total Gifts, the displayed value equals the corresponding
   row count a user would see in the legacy HTML when enabling matching
   filters. Total Gifts is not a row count: its value equals the sum of
   `amount` across all `membershipGiftPurchase` rows in the legacy
   HTML (which the legacy renders as the `(count: N, total: M)` text
   on the `membershipGiftPurchase` filter; Total Gifts equals `M`).
   Note: SPA `no` column is per-filter index, not equal to legacy
   HTML's absolute `No.` column.
7. Toggle filter chips; URL `?types=` updates (URL-encoded JSON array
   per §5.3); row list filters correctly; `no` column renumbers from 1
   on every change.
8. Move the significance slider from 1 to 7; SuperChat/Sticker rows
   below the threshold disappear; other types are unaffected.
9. Deselect all chips. Confirm the list area shows
   `"No row types selected"` and no virtualizer is rendered.
10. Click a timestamp on a row where `timestamp >= actualStart`. A new
    tab opens to `https://youtu.be/{videoId}?t={seconds}` where
    `seconds` equals `floor((row.timestamp - actualStart) / 1000)`.
11. For a row where `actualStart` is missing or `timestamp <
    actualStart`, the timestamp is plain text (not a link).
12. Switch timezone in TopBar from `Local` → `Asia/Tokyo` → `UTC`.
    Confirm all visible timestamps (TopBar breadcrumb does not show
    times, but video header `actualStart` / `availableAt`, every
    `VideoCard` status line on the index/channel pages, and every
    chat-row timestamp) reformat consistently. Setting persists across
    reload.
13. Switch theme `Light` → `Dark` → `System`. Setting persists across
    reload. `System` follows OS preference.
14. Navigate to `/channels/:channelId`. Confirm header (avatar + name +
    YouTube link icon) and video grid match the legacy
    `{channelId}/index.html`. Cards omit channel name (since it's in
    the header).
15. Scroll a video page with >10k rows. Confirm:
    - The scroll container is smooth (no full re-render on each scroll).
    - DOM size stays bounded (a few dozen row nodes, not 10k).
    - The browser tab does not OOM.
    - Rows of different types (chat vs superchat vs sticker) align in
      a stable grid; poll / raid rows fill the photo+author+body cells
      with their wider body but leave `no` and `ts` columns aligned.
16. Visit `/videos/:nonExistentId`. Confirm `"Archive not yet
    available"` warning is shown (404 on `meta.json` becomes a
    `NotFoundError` surfaced as a `warning` Alert).
17. Visit `/videos/:vidWithMetaButNoRows` (404 on `.jsonl`, 200 on
    `meta.json`). Confirm header + meta + chips render; list area
    shows `"No chat rows archived for this video"`.
18. Visit `/garbage` (no matching route). Confirm the `NotFound`
    component renders ("Not Found — VChat" title) with a Back to Home
    button. CloudFront serves `index.html` per §5.4.
19. Direct-load a deep URL (e.g.
    `https://{host}/videos/abc?types=%5B%22superChat%22%5D&minSig=3`)
    without going through `/` first. Confirm CloudFront serves
    `index.html` and the SPA bootstraps directly into the video page
    with the correct filter state.
20. Direct-load `/videos/:id` for a v1 (legacy) video. Confirm the SPA
    shows the `"Archive not yet available"` empty state (since
    `meta.json` is absent for v1 archives) and does not attempt to
    link to legacy HTML from this page.
21. After a deploy, confirm CloudFront invalidation includes
    `/index.html` and `/assets/*` but not `/data/*`. The legacy HTML
    files under `/{channelId}/...` are unaffected.
22. Local dev: `VITE_DATA_PROXY=https://prod-archive.example.com npm
    run dev`. Confirm the page loads against the remote `data/` tree
    without CORS errors (Vite proxy strips cross-origin concerns).

## 11. Constraints on implementation

- No source-code comments referencing this design document — no section
  markers, no "spec"/"plan" mentions, no "Task N". Field names and
  identifiers are expected to be self-explanatory.
- No unit tests in this PR. Verification is manual per §10.
- Unknown JSONL row types and unknown `VideoStatus` values do not crash
  the UI: unknown rows are dropped (`parseJSONL` in §4.2), unknown
  statuses render via the default branch (§6.4 #1). Both call
  `warnOnce(label, detail)` from `src/lib/jsonl.ts`, which keeps a
  module-level `Set<string>` deduping by `${label}:${detail}` so each
  unique offender produces exactly one `console.warn` per page session.
- No analytics, no error reporting service, no third-party scripts.
- All external links open in a new tab with `rel="noopener noreferrer"`.
- Avatars and thumbnails (`authorPhoto`, channel `avatarUrl`, YouTube
  thumbnail) load with `loading="lazy"` and
  `referrerPolicy="no-referrer"` for consistent hot-link behavior.
- Document title set per route via `useDocumentTitle` (§6.1). No
  `<meta name="robots">` is emitted; this is an internal-facing tool
  and indexing behavior is governed by the S3/CloudFront origin's
  HTTP headers if needed (out of scope here).
