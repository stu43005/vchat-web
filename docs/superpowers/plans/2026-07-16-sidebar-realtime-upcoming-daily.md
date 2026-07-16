# Sidebar navigation + realtime / upcoming / daily views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-codex:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the SPA's top-level navigation around honeybee's newer per-purpose data files (`realtime.json`, `upcoming.json`, `daily-videos/{date}.json`), add a persistent left sidebar, and overlay a YouTube-style live/duration badge plus a metrics row on video cards.

**Architecture:** Reader-only change. Add three payload types + four optional `VideoSummary` fields, three TanStack Query hooks (no polling), pure date/duration helpers, three shared display components, a sidebar wired into the root shell, and rewritten/new routes. The index route switches from `index.json` to `realtime.json`; the deprecated `IndexData`/`useIndexQuery` reader is removed last, after nothing uses it.

**Tech Stack:** React 19, TypeScript, TanStack Router (file-based) + TanStack Query v5.100.13, MUI v6 + `@mui/icons-material`, Vite, zod.

**Verification model (important):** This project has **no test harness** (no Jest/Vitest, no `test` script) and introducing one is out of scope per the spec. Each task is therefore verified with `npm run typecheck` (runs `tsr generate` + `tsc --noEmit`), `npm run lint`, and — for routing/integration tasks — `npm run build`, plus targeted manual checks. There are no unit-test steps.

**Reference spec:** `docs/superpowers/specs/2026-07-15-sidebar-realtime-upcoming-daily-design.md`

**Task order (dependency-driven):**
1. Types → 2. Date/duration helpers → 3. Query hooks → 4. MetricsRow → 5. useNowTick clock → 6. ThumbnailBadge → 7. VideoCard integration → 8. VideoHeader integration → 9. Index route rewrite → 10. Upcoming route → 11. Daily route → 12. AppSidebar → 13. Root shell + TopBar → 14. Dead-code cleanup → 15. Final verification.

Routes (Tasks 9–11) are created **before** `AppSidebar`/`__root` (Tasks 12–13) so that typed router links (`/upcoming`, `/daily/$date`) resolve against the generated route tree. Dead-code removal (Task 14) runs **after** the index route (Task 9) stops importing `useIndexQuery`.

---

## File Structure

**Created:**
- `src/lib/useNowTick.ts` — shared 1-second clock (`useSyncExternalStore`).
- `src/components/MetricsRow.tsx` — viewers/maxViewers/likes icon row.
- `src/components/ThumbnailBadge.tsx` — live/duration badge (+ `LiveElapsedBadge` child).
- `src/components/AppSidebar.tsx` — left navigation sidebar.
- `src/routes/upcoming.tsx` — `/upcoming` route.
- `src/routes/daily.$date.tsx` — `/daily/$date` route.

**Modified:**
- `src/api/types.ts` — add 4 optional fields + 3 payload interfaces; remove `IndexData` (Task 14).
- `src/api/queries.ts` — add 3 hooks; remove `useIndexQuery` (Task 14).
- `src/lib/format.ts` — add `todayYmdInTokyo`, `ymdDashInTokyo`, `addDaysYmd`, `formatDuration`, `isValidYmd`.
- `src/components/VideoCard.tsx` — insert `ThumbnailBadge` + `MetricsRow`.
- `src/components/VideoHeader.tsx` — insert `MetricsRow`.
- `src/routes/index.tsx` — realtime-driven rewrite, drop Tabs/`?tab`.
- `src/routes/__root.tsx` — wrap `<Outlet>` in the sidebar shell.
- `src/components/TopBar.tsx` — add mobile hamburger.

---

## Task 1: Add payload types and optional video fields

**Files:**
- Modify: `src/api/types.ts`

- [ ] **Step 1: Add the four optional fields to `VideoSummary`**

In `src/api/types.ts`, extend the existing `VideoSummary` interface (currently lines ~122-135) by adding four optional fields before its closing brace. The final interface must read:

```ts
export interface VideoSummary {
  id: string;
  title: string;
  channel: ChannelRef;
  status: VideoStatus;
  duration: number;
  availableAt: string;
  archiveVersion: number;
  stats: VideoStats;
  scheduledStart?: string;
  actualStart?: string;
  actualEnd?: string;
  publishedAt?: string;
  viewers?: number; // live concurrent viewers; 0 after finish
  maxViewers?: number; // peak concurrent viewers; persists after finish
  likes?: number; // like count; persists after finish
  premiere?: boolean; // true for YouTube premieres
}
```

- [ ] **Step 2: Add the three new payload interfaces**

Immediately after the `IndexData` interface (currently lines ~139-142), add:

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
  date: string; // "YYYY-MM-DD" (JST) — the day this file lists
  snapshotAt: string;
  videos: VideoSummary[];
}
```

Do **not** remove `IndexData` yet — `useIndexQuery` still depends on it until Task 14.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/types.ts
git commit -m "feat(types): add realtime/upcoming/daily payloads and optional video metrics"
```

---

## Task 2: Add date and duration helpers

**Files:**
- Modify: `src/lib/format.ts`

- [ ] **Step 1: Append the helpers**

Add the following to the end of `src/lib/format.ts` (after the existing `formatSuperAmount`). `ymdInTokyo` (the dashless `YYYYMMDD` legacy helper) stays untouched.

```ts
// JST calendar date as "YYYY-MM-DD" from an ISO instant. (ymdInTokyo above
// returns "YYYYMMDD" without dashes and is kept for the legacy redirect path.)
export function ymdDashInTokyo(iso: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

// Current JST calendar date as "YYYY-MM-DD".
export function todayYmdInTokyo(): string {
  return ymdDashInTokyo(new Date().toISOString());
}

// Pure calendar-date arithmetic on a "YYYY-MM-DD" string. Constructed in UTC
// so the result is free of the host timezone and DST — the string is treated
// as a bare calendar date, not an instant.
export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// True only for a real calendar date in "YYYY-MM-DD" shape. Rejects impossible
// dates such as "2026-99-99", "0000-00-00", "2026-02-30" via a UTC round-trip.
export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// YouTube-style clock format from a whole-second count. >= 3600s -> "H:MM:SS"
// (hours unpadded), else "M:SS" (minutes unpadded). Negative / non-finite -> "0:00".
export function formatDuration(seconds: number): string {
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h >= 1 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat(format): add JST date helpers, isValidYmd, and formatDuration"
```

---

## Task 3: Add realtime / upcoming / daily query hooks

**Files:**
- Modify: `src/api/queries.ts`

- [ ] **Step 1: Update imports**

At the top of `src/api/queries.ts`, extend the type import and add the format import. The existing import block becomes:

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchJson, fetchJsonl, NotFoundError } from "./client";
import type {
  ChannelData,
  ChatRow,
  DailyVideos,
  IndexData,
  RealtimeIndex,
  UpcomingIndex,
  VideoMeta,
} from "./types";
import { addDaysYmd, todayYmdInTokyo } from "../lib/format";
```

(`IndexData` stays imported until Task 14 because `useIndexQuery` still uses it.)

- [ ] **Step 2: Add the result type and three hooks**

Append the following to the end of `src/api/queries.ts` (after `useVideoRowsQuery`):

```ts
export function useRealtimeQuery(): UseQueryResult<RealtimeIndex> {
  return useQuery({
    queryKey: ["realtime"],
    queryFn: () => fetchJson<RealtimeIndex>("/realtime.json"),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
    refetchOnWindowFocus: false,
  });
}

export function useUpcomingQuery(): UseQueryResult<UpcomingIndex> {
  return useQuery({
    queryKey: ["upcoming"],
    queryFn: () => fetchJson<UpcomingIndex>("/upcoming.json"),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
    refetchOnWindowFocus: false,
  });
}

export interface DailyVideosResult {
  resolvedDate: string;
  isFallback: boolean;
  data: DailyVideos;
}

// `dateParam` is the raw route param: the literal "today" or a "YYYY-MM-DD".
// For "today", fetch the current JST day; on 404 fall back once to the
// previous JST day (isFallback=true). Concrete dates never fall back.
export function useDailyVideosQuery(
  dateParam: string | undefined,
): UseQueryResult<DailyVideosResult> {
  return useQuery({
    queryKey: ["daily", dateParam],
    queryFn: async (): Promise<DailyVideosResult> => {
      if (dateParam === "today") {
        const today = todayYmdInTokyo();
        try {
          const data = await fetchJson<DailyVideos>(
            `/daily-videos/${today}.json`,
          );
          return { resolvedDate: today, isFallback: false, data };
        } catch (err) {
          if (err instanceof NotFoundError) {
            const yesterday = addDaysYmd(today, -1);
            const data = await fetchJson<DailyVideos>(
              `/daily-videos/${yesterday}.json`,
            );
            return { resolvedDate: yesterday, isFallback: true, data };
          }
          throw err;
        }
      }
      const date = dateParam as string;
      const data = await fetchJson<DailyVideos>(`/daily-videos/${date}.json`);
      return { resolvedDate: date, isFallback: false, data };
    },
    // Result-dependent staleness: a fallback (yesterday) result is always
    // stale so the next mount of /daily/today re-attempts today's file.
    // Supported by @tanstack/react-query 5.x (StaleTimeFunction).
    staleTime: (query) => (query.state.data?.isFallback ? 0 : 60_000),
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
    refetchOnWindowFocus: false,
    enabled: Boolean(dateParam),
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (In particular, `staleTime: (query) => …` must typecheck against v5's `StaleTimeFunction`.)

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/queries.ts
git commit -m "feat(queries): add realtime, upcoming, and daily-videos hooks"
```

---

## Task 4: MetricsRow component

**Files:**
- Create: `src/components/MetricsRow.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from "react";
import { Box, Stack, Tooltip } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";

interface MetricsRowProps {
  viewers?: number;
  maxViewers?: number;
  likes?: number;
}

const iconSx = { fontSize: "1rem" } as const;

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: number;
}) {
  return (
    <Tooltip title={label}>
      <Box
        component="span"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
      >
        {icon}
        <span>{value === undefined ? "—" : value.toLocaleString()}</span>
      </Box>
    </Tooltip>
  );
}

// Always renders all three metrics; a missing value shows an em dash. Labels
// are conveyed by tooltip only (no visible text label). Material Icons only.
export function MetricsRow({ viewers, maxViewers, likes }: MetricsRowProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        flexWrap: "wrap",
        color: "text.secondary",
        fontSize: "0.8125rem",
      }}
    >
      <Metric
        icon={<VisibilityIcon sx={iconSx} />}
        label="Current viewers"
        value={viewers}
      />
      <Metric
        icon={<TrendingUpIcon sx={iconSx} />}
        label="Peak concurrent viewers"
        value={maxViewers}
      />
      <Metric icon={<ThumbUpIcon sx={iconSx} />} label="Likes" value={likes} />
    </Stack>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/MetricsRow.tsx
git commit -m "feat(metrics-row): add viewers/maxViewers/likes icon row"
```

---

## Task 5: Shared 1-second clock (`useNowTick`)

**Files:**
- Create: `src/lib/useNowTick.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useSyncExternalStore } from "react";

// A single shared 1s clock. The interval runs only while at least one
// component is subscribed (i.e. at least one live-elapsed badge is mounted).
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (timer === null) {
    // Refresh immediately so the first render after subscribing uses a
    // current timestamp rather than a stale module-load value.
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return now;
}

// Returns the current epoch-ms snapshot and re-renders once per second.
export function useNowTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/useNowTick.ts
git commit -m "feat(clock): add shared 1s useNowTick store"
```

---

## Task 6: ThumbnailBadge + LiveElapsedBadge

**Files:**
- Create: `src/components/ThumbnailBadge.tsx`

- [ ] **Step 1: Create the component**

`ThumbnailBadge` calls **no** clock hook; the live-elapsed variant is a separate `LiveElapsedBadge` child that owns `useNowTick()`. This keeps hook order stable across status transitions (no conditional hook in `ThumbnailBadge`).

```tsx
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { VideoSummary } from "../api/types";
import { formatDuration } from "../lib/format";
import { useNowTick } from "../lib/useNowTick";

const badgeSx: SxProps<Theme> = {
  position: "absolute",
  bottom: 8,
  right: 8,
  px: 0.75,
  py: 0.25,
  borderRadius: 0.5,
  fontSize: "0.75rem",
  fontWeight: 700,
  lineHeight: 1.2,
  color: "#fff",
  pointerEvents: "none",
};

// Live elapsed timer; the only variant that subscribes to the shared clock.
function LiveElapsedBadge({ actualStart }: { actualStart: string }) {
  const now = useNowTick();
  const elapsed = Math.max(0, Math.floor((now - Date.parse(actualStart)) / 1000));
  return <Box sx={{ ...badgeSx, bgcolor: "error.main" }}>{formatDuration(elapsed)}</Box>;
}

interface ThumbnailBadgeProps {
  status: VideoSummary["status"] | string;
  premiere?: boolean;
  actualStart?: string;
  duration: number;
}

export function ThumbnailBadge({
  status,
  premiere,
  actualStart,
  duration,
}: ThumbnailBadgeProps) {
  if (status === "live") {
    if (premiere) {
      return <Box sx={{ ...badgeSx, bgcolor: "error.main" }}>Premiere</Box>;
    }
    if (actualStart) {
      return <LiveElapsedBadge actualStart={actualStart} />;
    }
    return <Box sx={{ ...badgeSx, bgcolor: "error.main" }}>Live</Box>;
  }
  if ((status === "past" || status === "missing") && duration > 0) {
    return (
      <Box sx={{ ...badgeSx, bgcolor: "rgba(0,0,0,0.75)" }}>
        {formatDuration(duration)}
      </Box>
    );
  }
  return null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThumbnailBadge.tsx
git commit -m "feat(thumbnail-badge): add live/duration badge with LiveElapsedBadge child"
```

---

## Task 7: Integrate MetricsRow + ThumbnailBadge into VideoCard

**Files:**
- Modify: `src/components/VideoCard.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/VideoCard.tsx`, after the existing `import { StatusText } from "./StatusText";` line, add:

```tsx
import { MetricsRow } from "./MetricsRow";
import { ThumbnailBadge } from "./ThumbnailBadge";
```

- [ ] **Step 2: Insert the badge into the thumbnail Box**

The thumbnail `Box` currently contains the `<Box component="img" … />` and the `{isLegacy && <Chip … />}` block, wrapped in
`<Box sx={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>`.
Add the badge as the **last child** of that relative `Box`, immediately after the `{isLegacy && ( … )}` Chip block and before that `Box`'s closing tag:

```tsx
          <ThumbnailBadge
            status={video.status}
            premiere={video.premiere}
            actualStart={video.actualStart}
            duration={video.duration}
          />
```

The badge is `position: absolute` with `pointer-events: none`, so it renders over the thumbnail and does not intercept the card's overlay-link clicks.

- [ ] **Step 3: Insert the metrics row under StatusText**

The second `CardContent` contains the channel link and a
`<Typography variant="caption" …>` wrapping `<StatusText … />`. Immediately **after** that closing `</Typography>` (and before the `CardContent` closes), add:

```tsx
          <Box
            sx={{ position: "relative", zIndex: 2, pointerEvents: "auto", mt: 0.5 }}
          >
            <MetricsRow
              viewers={video.viewers}
              maxViewers={video.maxViewers}
              likes={video.likes}
            />
          </Box>
```

**Why the wrapper:** `VideoCard`'s content sits in a `Box` with `pointerEvents: "none"` (so clicks fall through to the full-card overlay link). MUI `Tooltip` needs pointer/focus events on its child, so the metrics row must re-enable them — mirroring the existing channel-link exception in this file (`position: relative; zIndex: 2; pointerEvents: auto`). `Box` is already imported in `VideoCard`. The consequence is that the metrics-row strip itself is not a click-through-to-navigate area (the rest of the card still is), which is acceptable and matches how the channel link already opts back in.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add src/components/VideoCard.tsx
git commit -m "feat(video-card): add thumbnail badge and metrics row"
```

---

## Task 8: Integrate MetricsRow into VideoHeader

**Files:**
- Modify: `src/components/VideoHeader.tsx`

- [ ] **Step 1: Add the import**

After `import { StatusText } from "./StatusText";` in `src/components/VideoHeader.tsx`, add:

```tsx
import { MetricsRow } from "./MetricsRow";
```

- [ ] **Step 2: Insert the metrics row under StatusText**

The inner `<Stack spacing={1} …>` ends with a
`<Typography variant="body2" color="text.secondary">` wrapping `<StatusText … />`. Immediately **after** that closing `</Typography>` (still inside the inner `Stack`), add:

```tsx
        <MetricsRow
          viewers={video.viewers}
          maxViewers={video.maxViewers}
          likes={video.likes}
        />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/VideoHeader.tsx
git commit -m "feat(video-header): add metrics row under status"
```

---

## Task 9: Rewrite the index route to be realtime-driven

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/routes/index.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";
import { useRealtimeQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  useDocumentTitle("VChat");
  const query = useRealtimeQuery();

  if (query.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" sx={{ aspectRatio: "16/9" }} />
              <Skeleton width="80%" />
              <Skeleton width="60%" />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (query.isError) {
    if (query.error instanceof NotFoundError) {
      return (
        <Container sx={{ py: 2 }}>
          <Alert severity="warning">No realtime data found.</Alert>
        </Container>
      );
    }
    return (
      <Container sx={{ py: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => query.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Failed to load live streams.
        </Alert>
      </Container>
    );
  }

  const list = query.data.live;

  return (
    <Container sx={{ py: 2 }}>
      {list.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Typography color="text.secondary">No live streams right now</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {list.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={video.channel} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
```

This removes the `Tabs`/`Tab` imports, the `z` import, `indexSearchSchema`, `validateSearch`, and the `useIndexQuery`/`useNavigate` usage. A stale `/?tab=…` link now resolves to Live (the param is simply ignored).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(index): drive Live view from realtime.json, drop tabs"
```

---

## Task 10: Add the `/upcoming` route

**Files:**
- Create: `src/routes/upcoming.tsx`

- [ ] **Step 1: Create the route**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";
import { useUpcomingQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { VideoSummary } from "../api/types";

export const Route = createFileRoute("/upcoming")({
  component: UpcomingPage,
});

function Section({
  title,
  videos,
  emptyNote,
}: {
  title: string;
  videos: VideoSummary[];
  emptyNote: string;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {videos.length === 0 ? (
        <Typography color="text.secondary">{emptyNote}</Typography>
      ) : (
        <Grid container spacing={2}>
          {videos.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={video.channel} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

function UpcomingPage() {
  useDocumentTitle("Upcoming — VChat");
  const query = useUpcomingQuery();

  if (query.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" sx={{ aspectRatio: "16/9" }} />
              <Skeleton width="80%" />
              <Skeleton width="60%" />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (query.isError) {
    if (query.error instanceof NotFoundError) {
      return (
        <Container sx={{ py: 2 }}>
          <Alert severity="warning">No upcoming data found.</Alert>
        </Container>
      );
    }
    return (
      <Container sx={{ py: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => query.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Failed to load upcoming streams.
        </Alert>
      </Container>
    );
  }

  const { recentlyStarted, upcoming } = query.data;

  return (
    <Container sx={{ py: 2 }}>
      <Section
        title="Recently Started"
        videos={recentlyStarted}
        emptyNote="No recently started streams"
      />
      <Section
        title="Scheduled"
        videos={upcoming}
        emptyNote="No scheduled streams"
      />
    </Container>
  );
}
```

- [ ] **Step 2: Typecheck (regenerates the route tree)**

Run: `npm run typecheck`
Expected: PASS. `tsr generate` adds `/upcoming` to `src/routeTree.gen.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/upcoming.tsx src/routeTree.gen.ts
git commit -m "feat(upcoming): add /upcoming route with recently-started and scheduled sections"
```

---

## Task 11: Add the `/daily/$date` route

**Files:**
- Create: `src/routes/daily.$date.tsx`

- [ ] **Step 1: Create the route**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { z } from "zod";
import { useDailyVideosQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { NotFound } from "../components/NotFound";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { addDaysYmd, isValidYmd, todayYmdInTokyo } from "../lib/format";
import type { VideoSummary } from "../api/types";

type SortKey = "availableAt" | "maxViewers" | "likes";

const dailySearchSchema = z.object({
  sort: z.enum(["availableAt", "maxViewers", "likes"]).default("availableAt"),
});

export const Route = createFileRoute("/daily/$date")({
  validateSearch: dailySearchSchema,
  component: DailyPage,
});

function byIdAsc(a: VideoSummary, b: VideoSummary): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Returns a sorted shallow copy; missing metric values sort last; ties by id.
function sortVideos(videos: VideoSummary[], sort: SortKey): VideoSummary[] {
  const copy = [...videos];
  if (sort === "availableAt") {
    copy.sort((a, b) =>
      a.availableAt < b.availableAt
        ? 1
        : a.availableAt > b.availableAt
          ? -1
          : byIdAsc(a, b),
    );
    return copy;
  }
  copy.sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    const am = av === undefined;
    const bm = bv === undefined;
    if (am && bm) return byIdAsc(a, b);
    if (am) return 1;
    if (bm) return -1;
    if (bv !== av) return bv - av;
    return byIdAsc(a, b);
  });
  return copy;
}

function DailyPage() {
  const { date } = Route.useParams();
  const { sort } = Route.useSearch();
  const navigate = useNavigate();

  const isToday = date === "today";
  const valid = isToday || (isValidYmd(date) && date <= todayYmdInTokyo());
  const query = useDailyVideosQuery(valid ? date : undefined);

  const resolvedDate = query.data?.resolvedDate ?? (isToday ? "" : date);
  useDocumentTitle(resolvedDate ? `${resolvedDate} — VChat` : "VChat");

  if (!valid) return <NotFound />;

  if (query.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" sx={{ aspectRatio: "16/9" }} />
              <Skeleton width="80%" />
              <Skeleton width="60%" />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (query.isError) {
    if (query.error instanceof NotFoundError) {
      return (
        <Container sx={{ py: 2 }}>
          <Typography color="text.secondary" sx={{ py: 8, textAlign: "center" }}>
            No data for this date
          </Typography>
        </Container>
      );
    }
    return (
      <Container sx={{ py: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => query.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Failed to load daily videos.
        </Alert>
      </Container>
    );
  }

  const { resolvedDate: rd, isFallback, data } = query.data;
  const nextDisabled = rd >= todayYmdInTokyo();
  const sorted = sortVideos(data.videos, sort);

  return (
    <Container sx={{ py: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          aria-label="previous day"
          onClick={() =>
            navigate({
              to: "/daily/$date",
              params: { date: addDaysYmd(rd, -1) },
              search: { sort },
            })
          }
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6">{rd}</Typography>
        <IconButton
          aria-label="next day"
          disabled={nextDisabled}
          onClick={() =>
            navigate({
              to: "/daily/$date",
              params: { date: addDaysYmd(rd, 1) },
              search: { sort },
            })
          }
        >
          <ChevronRightIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sort}
          onChange={(_, value: SortKey | null) => {
            if (value) {
              navigate({
                to: "/daily/$date",
                params: { date },
                search: { sort: value },
                replace: true,
              });
            }
          }}
        >
          <ToggleButton value="availableAt">Time</ToggleButton>
          <ToggleButton value="maxViewers">Max Viewers</ToggleButton>
          <ToggleButton value="likes">Likes</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {isFallback && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button onClick={() => query.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Today's list isn't available yet — showing {rd}.
        </Alert>
      )}

      {sorted.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Typography color="text.secondary">
            No streams started this day
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {sorted.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={video.channel} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
```

Notes for the implementer:
- `useDocumentTitle` and `useDailyVideosQuery` are called before any conditional return, so hook order is stable regardless of `valid`.
- When `valid` is false the hook is disabled (`useDailyVideosQuery(undefined)` → `enabled: false`) and `<NotFound />` renders without a network request.
- The prev/next buttons navigate to concrete dates from `resolvedDate`; the sort toggle preserves the current URL param (`date`, which may stay `"today"`).

- [ ] **Step 2: Typecheck (regenerates the route tree)**

Run: `npm run typecheck`
Expected: PASS. `tsr generate` adds `/daily/$date` to `src/routeTree.gen.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/daily.\$date.tsx src/routeTree.gen.ts
git commit -m "feat(daily): add /daily/\$date route with date and sort controls"
```

---

## Task 12: AppSidebar component

**Files:**
- Create: `src/components/AppSidebar.tsx`

Depends on the `/`, `/upcoming`, and `/daily/$date` routes existing (Tasks 9–11) so the typed router links resolve.

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from "react";
import { Drawer, List } from "@mui/material";
import { useRouterState } from "@tanstack/react-router";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import { RouterBox } from "../lib/createMuiLink";

export const DRAWER_WIDTH = 220;

const itemSx = (active: boolean) => ({
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  px: 2,
  py: 1.25,
  color: "inherit",
  textDecoration: "none",
  cursor: "pointer",
  bgcolor: active ? "action.selected" : "transparent",
  "&:hover": { bgcolor: "action.hover" },
});

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname, search } = useRouterState({ select: (s) => s.location });
  const sort = (search as { sort?: string }).sort;

  const label = (icon: ReactNode, text: string) => (
    <>
      {icon}
      <span>{text}</span>
    </>
  );

  return (
    <List disablePadding onClick={onNavigate}>
      <RouterBox to="/" sx={itemSx(pathname === "/")}>
        {label(<LiveTvIcon fontSize="small" />, "Live")}
      </RouterBox>
      <RouterBox to="/upcoming" sx={itemSx(pathname === "/upcoming")}>
        {label(<ScheduleIcon fontSize="small" />, "Upcoming")}
      </RouterBox>
      <RouterBox
        to="/daily/$date"
        params={{ date: "today" }}
        search={{ sort: "maxViewers" }}
        sx={itemSx(pathname === "/daily/today" && sort === "maxViewers")}
      >
        {label(<VisibilityIcon fontSize="small" />, "Top Viewers Today")}
      </RouterBox>
      <RouterBox
        to="/daily/$date"
        params={{ date: "today" }}
        search={{ sort: "likes" }}
        sx={itemSx(pathname === "/daily/today" && sort === "likes")}
      >
        {label(<ThumbUpIcon fontSize="small" />, "Top Likes Today")}
      </RouterBox>
    </List>
  );
}

interface AppSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ mobileOpen, onClose }: AppSidebarProps) {
  return (
    <>
      {/* Desktop: permanent drawer, paper offset below the sticky TopBar. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            top: "var(--topbar-h)",
            height: "auto",
            bottom: 0,
          },
        }}
      >
        <SidebarNav />
      </Drawer>
      {/* Mobile: temporary overlay drawer, closes on navigation. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <SidebarNav onNavigate={onClose} />
      </Drawer>
    </>
  );
}
```

Notes:

- `RouterBox` is the existing `createLink(Box)` wrapper used by `TopBar`'s breadcrumbs; it accepts typed `to`/`params`/`search`.
- The desktop `Drawer` uses `variant="permanent"` (per spec §6.1). Its root reserves `DRAWER_WIDTH` in the `__root` flex row (`flexShrink: 0`); the paper is `position: fixed` by MUI default, offset with `top: var(--topbar-h)` / `bottom: 0` so it sits below the sticky `TopBar` rather than overlapping it.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (typed links to `/daily/$date` with `search.sort` resolve against the route tree from Task 11).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat(sidebar): add AppSidebar with primary navigation"
```

---

## Task 13: Wire the sidebar into the root shell + hamburger

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1: Add a mobile-menu prop + hamburger to TopBar**

In `src/components/TopBar.tsx`:

Add the `MenuIcon` import near the other icon imports:

```tsx
import MenuIcon from "@mui/icons-material/Menu";
```

Change the component signature to accept an optional callback:

```tsx
export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
```

Inside the `<Toolbar sx={{ gap: 2 }}>`, add the hamburger as the **first child**, before the `VChat` title `Typography` (it only shows on mobile, where `isMobile` is already computed in this component):

```tsx
        {isMobile && (
          <IconButton
            edge="start"
            onClick={onMenuClick}
            aria-label="open navigation"
          >
            <MenuIcon />
          </IconButton>
        )}
```

`IconButton` is already imported in `TopBar`. No other TopBar logic changes.

- [ ] **Step 2: Wrap the Outlet with the sidebar shell in __root**

Replace the contents of `src/routes/__root.tsx` with:

```tsx
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Box } from "@mui/material";
import { useState } from "react";
import { TopBar } from "../components/TopBar";
import { AppSidebar } from "../components/AppSidebar";
import { NotFound } from "../components/NotFound";
import { lazy, Suspense } from "react";

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;

const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null;

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <TopBar onMenuClick={() => setMobileOpen(true)} />
      <Box sx={{ display: "flex" }}>
        <AppSidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <RouterDevtools />
          <QueryDevtools />
        </Suspense>
      )}
    </Box>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/__root.tsx src/components/TopBar.tsx
git commit -m "feat(shell): add responsive sidebar and mobile hamburger to root layout"
```

---

## Task 14: Remove dead IndexData / useIndexQuery reader

**Files:**
- Modify: `src/api/queries.ts`
- Modify: `src/api/types.ts`

Nothing references `useIndexQuery` after Task 9. Remove it and its now-unused type.

- [ ] **Step 1: Remove `useIndexQuery` and its import from queries.ts**

In `src/api/queries.ts`:

- Delete the entire `useIndexQuery` function (the `export function useIndexQuery(): UseQueryResult<IndexData> { … }` block near the top).
- Remove `IndexData` from the `import type { … } from "./types";` list. After the edit, the top import block reads exactly:

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchJson, fetchJsonl, NotFoundError } from "./client";
import type {
  ChannelData,
  ChatRow,
  DailyVideos,
  RealtimeIndex,
  UpcomingIndex,
  VideoMeta,
} from "./types";
import { addDaysYmd, todayYmdInTokyo } from "../lib/format";
```

- [ ] **Step 2: Remove `IndexData` from types.ts**

In `src/api/types.ts`, delete the `IndexData` interface:

```ts
export interface IndexData {
  live: VideoSummary[];
  past: VideoSummary[];
}
```

- [ ] **Step 3: Confirm no remaining references**

Run: `rg -n "IndexData|useIndexQuery" src`
Expected: no output (both symbols fully removed).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add src/api/queries.ts src/api/types.ts
git commit -m "refactor(api): remove dead IndexData and useIndexQuery reader"
```

---

## Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full static checks**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS / SUCCESS.

- [ ] **Step 2: Manual exercise (dev server against a data source)**

Ensure `.env.local` sets `VITE_DATA_PROXY` to a deployment serving the honeybee `/data` tree, then run `npm run dev` and verify:

- `/` shows live streams from `realtime.json`; "No live streams right now" when `live` is empty.
- `/upcoming` shows **Recently Started** and **Scheduled** sections, each with its own empty note when empty.
- `/daily/today` resolves the current JST day; on a today-file 404 it shows yesterday with the info notice ("Today's list isn't available yet — showing {date}") and a working Retry.
- On `/daily/today`, the `‹ ›` switcher navigates between concrete days and the `›` button is disabled at today; the Time / Max Viewers / Likes toggle updates `?sort=` and re-sorts the list (missing metric values sort last).
- `/daily/{YYYY-MM-DD}` for a concrete past date that has a file shows that day's streams (independent of the `today` alias path).
- `/daily/2026-02-30` (impossible) and a future date render "Not Found" with **no** network request; `/daily/{a real past date with no file}` shows "No data for this date".
- Sidebar highlights the active entry; **Top Viewers Today** / **Top Likes Today** highlight only on `/daily/today` with the matching `sort`.
- Video cards show the metrics row (three icons + tooltips; `—` for missing values) and the thumbnail badge: a live stream with `actualStart` shows a red badge whose timer ticks each second; a live premiere shows "Premiere"; a live stream without `actualStart` shows "Live"; an ended stream shows its formatted duration on a black badge; an upcoming stream shows no badge. Clicking a card still navigates (badge does not intercept clicks).
- Mobile width (< `sm`): the hamburger opens/closes the temporary drawer, which closes on navigation; desktop (≥ `sm`) shows the permanent drawer, which sits below the TopBar without overlapping it.
- Video page (`/videos/{id}`) shows the metrics row under the status text.

- [ ] **Step 3: Commit (only if Step 1 or Step 2 required a fix)**

If the static checks and manual exercise all passed with no changes, there is
nothing to commit — skip this step entirely.

If a fix was required, stage only the specific files you actually modified,
naming each path explicitly on the `git add` line (do not use `git add -A` or
`git add .`), then commit with the message
`fix: address final verification findings`.
