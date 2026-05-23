# vchat-web SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React 19 + Vite + TypeScript SPA defined in
`docs/superpowers/specs/2026-05-23-vchat-web-spa-design.md`,
consuming honeybee's JSON/JSONL archive artifacts and replacing three
static HTML pages with a dynamic client-rendered UI.

**Architecture:** TanStack Router (file-based) hosts three routes
(Home, Channel, Video). TanStack Query owns all fetches against
`/data/*.{json,jsonl}` served same-origin from S3 + CloudFront.
MUI v6 provides primitives; `@tanstack/react-virtual` powers the chat
list. Build via `npm run build`, deploy via GitHub Actions OIDC to S3
with CloudFront invalidation.

**Tech Stack:** React 19, Vite, TypeScript, `@tanstack/react-router`
(file-based) + `@tanstack/router-plugin/vite`, `@tanstack/react-query`,
`@tanstack/react-virtual`, Material UI v6 (`@mui/material`,
`@emotion/react`, `@emotion/styled`, `@mui/icons-material`), `zod`,
Node 24, npm.

**Verification model:** Per spec §11, **no unit tests**. Each task ends
with `npm run typecheck && npm run lint`. UI tasks add a manual smoke
step (start `npm run dev`, visit URL, confirm rendered state). Final
acceptance is the §10 manual verification checklist run against a
staging deployment, scheduled outside this plan.

---

## Task 0: Bootstrap project + install dependencies

**Files:**
- Create: `package.json` (overwritten by `npm create vite`), `vite.config.ts`,
  `tsconfig.json`, `tsconfig.node.json`, `tsconfig.app.json`,
  `eslint.config.js`, `index.html`, `.gitignore`, `.env.example`,
  `public/` (Vite default), `README.md`

### Steps

- [ ] **Step 1: Scaffold a Vite React-TS project into the empty repo**

The working directory is `/Users/stu43005/Sources/vchat-web` and is an
empty git repo (single commit history is fine; files only — no other
config). Run:

```bash
npm create vite@latest . -- --template react-ts
```

Answer `y` to "Current directory is not empty. Continue?" if asked.
The scaffolder creates `package.json`, `vite.config.ts`, `tsconfig.json`
group, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`,
`src/App.css`, `src/index.css`, `src/assets/`, `src/vite-env.d.ts`,
`public/vite.svg`.

- [ ] **Step 2: Delete scaffolded demo content the spec does not use**

```bash
rm -rf src/App.tsx src/App.css src/index.css src/assets public/vite.svg
```

`src/main.tsx` will be fully overwritten in Task 14; for now it can
keep the scaffolded content (we'll fix it then).

- [ ] **Step 3: Install pinned runtime dependencies**

```bash
npm install \
  @tanstack/react-router \
  @tanstack/react-query \
  @tanstack/react-virtual \
  @mui/material \
  @mui/icons-material \
  @emotion/react \
  @emotion/styled \
  zod
```

- [ ] **Step 4: Install pinned dev dependencies**

```bash
npm install -D \
  @tanstack/router-plugin \
  @tanstack/react-router-devtools \
  @tanstack/react-query-devtools
```

- [ ] **Step 5: Overwrite `vite.config.ts`**

Replace the scaffolded contents with the following:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
  base: "/",
  build: {
    target: "es2022",
    outDir: "dist",
  },
  server: {
    proxy: {
      "/data": {
        target: process.env.VITE_DATA_PROXY ?? "https://archive.example.com",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 6: Update `tsconfig.app.json` (or `tsconfig.json` if monolithic)**

Ensure the TS config contains these compiler options (merge with the
scaffolded defaults; do not delete the scaffolded `include`/`exclude`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "useDefineForClassFields": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

- [ ] **Step 7: Append to `.gitignore`**

Add the following lines to the scaffolded `.gitignore` (append; do not
overwrite):

```
.env
.env.local
.env.*.local
src/routeTree.gen.ts
```

- [ ] **Step 8: Create `.env.example`**

Write file `.env.example`:

```
# When running `npm run dev`, requests to /data/* are proxied to this URL.
# Override in .env.local. Point at a deployment that has the honeybee-written
# /data tree (production CloudFront URL, or a local mirror).
VITE_DATA_PROXY=https://archive.example.com

# Alternative: bypass the proxy entirely and fetch /data from a fully-qualified URL.
# Requires CORS on the target. Leave commented out unless needed.
# VITE_DATA_BASE=https://archive.example.com/data
```

- [ ] **Step 9: Add `package.json` scripts**

Edit `package.json` `scripts` section to:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "typecheck": "tsc -b --noEmit"
}
```

(`tsc -b` uses the project-references setup that Vite scaffolds. Use
`tsc --noEmit` if your scaffold produced a flat tsconfig.)

- [ ] **Step 10: Create empty placeholder `index.html` (keep Vite's default if present)**

Verify the scaffolded `index.html` contains `<title>VChat</title>`.
If not, edit the `<title>` tag:

```html
<title>VChat</title>
```

- [ ] **Step 11: Create minimal `README.md`**

Write file `README.md`:

```markdown
# vchat-web

React SPA that renders honeybee chat archives. See
`docs/superpowers/specs/2026-05-23-vchat-web-spa-design.md`.

## Local development

Copy `.env.example` to `.env.local` and set `VITE_DATA_PROXY` to any
deployment that serves the honeybee-written `/data` tree. Then:

```
npm install
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server on http://localhost:5173
- `npm run build` — type-check + production build into `dist/`
- `npm run preview` — serve the built `dist/` locally
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc -b --noEmit`

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml` which builds and
syncs to S3 via OIDC, then invalidates CloudFront. Required secrets:
`AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET`, `CF_DIST_ID`.
```

- [ ] **Step 12: Verify build + lint pass with scaffolded content**

```bash
npm run typecheck && npm run lint
```

Expected: both succeed (the scaffolded `main.tsx` is still in place but
should pass its own lint/typecheck).

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js index.html .gitignore .env.example README.md src/main.tsx src/vite-env.d.ts
git commit -m "chore: scaffold Vite React-TS project + pinned deps"
```

---

## Task 1: Currency reference data (`src/lib/currency.ts`)

**Files:**
- Create: `src/lib/currency.ts`

### Steps

- [ ] **Step 1: Create `src/lib/currency.ts` as a verbatim copy of honeybee's currencyMap**

The source is `/Users/stu43005/Sources/honeybee/src/data/currency.ts`
(1145 lines). Copy the file verbatim into `src/lib/currency.ts`, with
the following minimal adjustments:

1. Change the local `type` declarations to `export type`:
   - `type CurrencyMap = ...` → `export type CurrencyMap = ...`
   - `type CurrencyMapEntry = ...` → `export type CurrencyMapEntry = ...`
2. Prepend this one-line header above the type declarations:

```ts
// Verbatim copy of honeybee src/data/currency.ts currencyMap.
// To update: re-copy from honeybee; do not hand-edit entries here.
```

Do NOT modify any entry value, key, or ordering. Do NOT trim to a
subset. The full ~160-entry map is required so unknown SuperChat
currencies render with correct fraction digits.

Read the source file using:

```bash
cat /Users/stu43005/Sources/honeybee/src/data/currency.ts
```

Then write the result into `src/lib/currency.ts`.

- [ ] **Step 2: Sanity-check known critical entries**

```bash
grep -E "^  (JPY|TWD|IDR|COP|USD|BHD):" src/lib/currency.ts
```

Expected output includes a block for each of those codes; verify by
inspection that JPY/TWD/IDR/COP have `decimal_digits: 0`, USD has
`decimal_digits: 2`, BHD has `decimal_digits: 3`.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/currency.ts
git commit -m "feat: copy honeybee currencyMap into src/lib/currency.ts"
```

---

## Task 2: Domain types (`src/api/types.ts`)

**Files:**
- Create: `src/api/types.ts`

### Steps

- [ ] **Step 1: Write `src/api/types.ts`**

```ts
export interface AuthorFields {
  id: string;
  timestamp: string;
  authorName?: string;
  authorPhoto?: string;
  authorChannelId: string;
  authorType: "owner" | "moderator" | "member" | "verified" | "other";
  membership?: string;
  isVerified: boolean;
  isOwner: boolean;
  isModerator: boolean;
}

export interface ChatRowChat extends AuthorFields {
  type: "chat";
  message: string;
}

export interface ChatRowSuperChat extends AuthorFields {
  type: "superChat";
  message: string | null;
  amount: number;
  currency: string;
  jpyAmount: number;
  significance?: number;
  color?: string;
}

export interface ChatRowSuperSticker extends AuthorFields {
  type: "superSticker";
  text?: string;
  image: string;
  amount: number;
  currency: string;
  jpyAmount: number;
  significance?: number;
  color?: string;
}

export interface ChatRowMembership extends AuthorFields {
  type: "membership";
  level?: string;
  since?: string;
}

export interface ChatRowMembershipGift extends AuthorFields {
  type: "membershipGift";
  senderName?: string;
}

export interface ChatRowMembershipGiftPurchase extends AuthorFields {
  type: "membershipGiftPurchase";
  amount: number;
}

export interface ChatRowMilestone extends AuthorFields {
  type: "milestone";
  message: string | null;
  level?: string;
  duration?: number;
  since?: string;
}

export interface ChatRowPoll {
  type: "poll";
  id: string;
  timestamp: string;
  createdAt?: string;
  question?: string;
  choices: Array<{ text: string; voteRatio?: number }>;
  voteCount?: number;
}

export interface ChatRowRaid {
  type: "raid";
  id?: string;
  timestamp: string;
  sourceVideoId?: string;
  sourceChannelId?: string;
  sourceName: string;
  sourcePhoto?: string;
}

export interface ChatRowRaidOutgoing {
  type: "raidOutgoing";
  id?: string;
  timestamp: string;
  originVideoId: string;
  originChannelId?: string;
  originName?: string;
  originPhoto?: string;
}

export type ChatRow =
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

export type FilterableType = Exclude<ChatRow["type"], "raidOutgoing">;

export interface ChannelRef {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface VideoStats {
  superChatTotalJpy: number;
  memberCount: number;
  giftCount: number;
}

export type VideoStatus = "new" | "upcoming" | "live" | "past" | "missing";

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
}

export type VideoSummaryWithoutChannel = Omit<VideoSummary, "channel">;

export interface IndexData {
  live: VideoSummary[];
  past: VideoSummary[];
}

export interface ChannelData extends ChannelRef {
  videos: VideoSummaryWithoutChannel[];
}

export interface CurrencyAgg {
  currency: string;
  amount: number;
  jpyAmount: number;
}

export interface VideoAggregates {
  chatCount: number;
  superChatCount: number;
  superStickerCount: number;
  membershipCount: number;
  giftCount: number;
  giftPurchaseCount: number;
  totalGiftAmount: number;
  milestoneCount: number;
  pollCount: number;
  raidCount: number;
  currencyTable: CurrencyAgg[];
  jpyTotal: number;
}

export interface VideoMeta extends VideoSummary {
  aggregates: VideoAggregates;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/types.ts
git commit -m "feat: domain types mirroring honeybee JSONL contract"
```

---

## Task 3: Format helpers (`src/lib/format.ts`)

**Files:**
- Create: `src/lib/format.ts`

### Steps

- [ ] **Step 1: Write `src/lib/format.ts`**

```ts
import { currencyMap } from "./currency";

export type TimezonePref = "local" | "Asia/Tokyo" | "UTC";

export function formatCurrency(
  amount: number,
  currency: string,
  style: "currency" | "decimal" = "currency",
): string {
  const digits = currencyMap[currency]?.decimal_digits ?? 2;
  return amount.toLocaleString("en-US", {
    style,
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatTimestamp(iso: string, timezone: TimezonePref): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: timezone === "local" ? undefined : timezone,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function getYouTubeUrl(videoId: string, t?: number): string {
  return t !== undefined
    ? `https://youtu.be/${videoId}?t=${t}`
    : `https://youtu.be/${videoId}`;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function ymdInTokyo(iso: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
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

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: format helpers (currency, timestamp, YouTube URL, legacy href)"
```

---

## Task 4: JSONL parser (`src/lib/jsonl.ts`)

**Files:**
- Create: `src/lib/jsonl.ts`

### Steps

- [ ] **Step 1: Write `src/lib/jsonl.ts`**

```ts
import type { ChatRow } from "../api/types";

const KNOWN_TYPES: ReadonlySet<ChatRow["type"]> = new Set([
  "chat",
  "superChat",
  "superSticker",
  "membership",
  "membershipGift",
  "membershipGiftPurchase",
  "milestone",
  "poll",
  "raid",
  "raidOutgoing",
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
    if (
      typeof row.type === "string" &&
      !KNOWN_TYPES.has(row.type as ChatRow["type"])
    ) {
      warnOnce("unknown row type", row.type);
      continue;
    }
    out.push(row as T);
  }
  return out;
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/jsonl.ts
git commit -m "feat: parseJSONL + warnOnce helper for unknown row types"
```

---

## Task 5: API client (`src/api/client.ts`)

**Files:**
- Create: `src/api/client.ts`

### Steps

- [ ] **Step 1: Write `src/api/client.ts`**

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

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/client.ts
git commit -m "feat: fetchJson/fetchJsonl + NotFoundError"
```

---

## Task 6: React Query hooks (`src/api/queries.ts`)

**Files:**
- Create: `src/api/queries.ts`

### Steps

- [ ] **Step 1: Write `src/api/queries.ts`**

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchJson, fetchJsonl, NotFoundError } from "./client";
import type {
  ChannelData,
  ChatRow,
  IndexData,
  VideoMeta,
} from "./types";

const retryOnNon404 = (failureCount: number, error: unknown) =>
  !(error instanceof NotFoundError) && failureCount < 3;

export function useIndexQuery(): UseQueryResult<IndexData> {
  return useQuery({
    queryKey: ["index"],
    queryFn: () => fetchJson<IndexData>("/index.json"),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
  });
}

export function useChannelQuery(channelId: string): UseQueryResult<ChannelData> {
  return useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => fetchJson<ChannelData>(`/channels/${channelId}.json`),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
  });
}

export function useVideoMetaQuery(videoId: string): UseQueryResult<VideoMeta> {
  return useQuery({
    queryKey: ["videoMeta", videoId],
    queryFn: () => fetchJson<VideoMeta>(`/videos/${videoId}.meta.json`),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: retryOnNon404,
  });
}

export function useVideoRowsQuery(videoId: string): UseQueryResult<ChatRow[]> {
  return useQuery({
    queryKey: ["videoRows", videoId],
    queryFn: () => fetchJsonl<ChatRow>(`/videos/${videoId}.jsonl`),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: retryOnNon404,
  });
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/queries.ts
git commit -m "feat: React Query hooks for index/channel/videoMeta/videoRows"
```

---

## Task 7: Settings hook (`src/lib/settings.ts`)

**Files:**
- Create: `src/lib/settings.ts`

### Steps

- [ ] **Step 1: Write `src/lib/settings.ts`**

```ts
import { useEffect, useState } from "react";
import type { TimezonePref } from "./format";

export type ThemePref = "light" | "dark" | "system";

const TZ_KEY = "vchat:timezone";
const THEME_KEY = "vchat:theme";

const isTimezone = (v: unknown): v is TimezonePref =>
  v === "local" || v === "Asia/Tokyo" || v === "UTC";

const isTheme = (v: unknown): v is ThemePref =>
  v === "light" || v === "dark" || v === "system";

function readStored<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return guard(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function useTimezonePref(): [TimezonePref, (next: TimezonePref) => void] {
  const [value, setValue] = useState<TimezonePref>(() =>
    readStored<TimezonePref>(TZ_KEY, isTimezone, "local"),
  );
  useEffect(() => {
    try {
      localStorage.setItem(TZ_KEY, value);
    } catch {
      /* localStorage unavailable */
    }
  }, [value]);
  return [value, setValue];
}

export function useThemePref(): [ThemePref, (next: ThemePref) => void] {
  const [value, setValue] = useState<ThemePref>(() =>
    readStored<ThemePref>(THEME_KEY, isTheme, "system"),
  );
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      /* localStorage unavailable */
    }
  }, [value]);
  return [value, setValue];
}

export function useResolvedTheme(): "light" | "dark" {
  const [pref] = useThemePref();
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref]);
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemDark ? "dark" : "light";
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/settings.ts
git commit -m "feat: theme + timezone hooks with localStorage persistence"
```

---

## Task 8: useDocumentTitle hook (`src/lib/useDocumentTitle.ts`)

**Files:**
- Create: `src/lib/useDocumentTitle.ts`

### Steps

- [ ] **Step 1: Write `src/lib/useDocumentTitle.ts`**

```ts
import { useEffect } from "react";

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/useDocumentTitle.ts
git commit -m "feat: useDocumentTitle hook"
```

---

## Task 9: MUI theme (`src/theme.ts`)

**Files:**
- Create: `src/theme.ts`

### Steps

- [ ] **Step 1: Write `src/theme.ts`**

```ts
import { createTheme, type Theme } from "@mui/material/styles";

export const CHATLIST_PAD_PX = 16;

const baseOptions = {
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
};

export const lightTheme: Theme = createTheme({
  ...baseOptions,
  palette: { mode: "light" },
});

export const darkTheme: Theme = createTheme({
  ...baseOptions,
  palette: { mode: "dark" },
});
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/theme.ts
git commit -m "feat: MUI light/dark themes + CHATLIST_PAD_PX constant"
```

---

## Task 10: NotFound component (`src/components/NotFound.tsx`)

**Files:**
- Create: `src/components/NotFound.tsx`

### Steps

- [ ] **Step 1: Write `src/components/NotFound.tsx`**

```tsx
import { Box, Button, Typography } from "@mui/material";
import { Link } from "@tanstack/react-router";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function NotFound() {
  useDocumentTitle("Not Found — VChat");
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 2,
      }}
    >
      <Typography variant="h4">Not Found</Typography>
      <Typography color="text.secondary">
        The page you requested does not exist.
      </Typography>
      <Button component={Link} to="/" variant="contained">
        Back to Home
      </Button>
    </Box>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotFound.tsx
git commit -m "feat: NotFound component"
```

---

## Task 11: StatusText component (`src/components/StatusText.tsx`)

**Files:**
- Create: `src/components/StatusText.tsx`

### Steps

- [ ] **Step 1: Write `src/components/StatusText.tsx`**

```tsx
import { Box } from "@mui/material";
import type { VideoStatus } from "../api/types";
import { formatTimestamp, type TimezonePref } from "../lib/format";
import { warnOnce } from "../lib/jsonl";

interface StatusTextProps {
  status: VideoStatus | string;
  scheduledStart?: string;
  actualStart?: string;
  availableAt: string;
  timezone: TimezonePref;
}

export function StatusText(props: StatusTextProps) {
  const { status, scheduledStart, actualStart, availableAt, timezone } = props;

  switch (status) {
    case "upcoming":
    case "new":
      return scheduledStart ? (
        <>Start at {formatTimestamp(scheduledStart, timezone)}</>
      ) : (
        <>Upcoming</>
      );
    case "live":
      return (
        <Box component="span" sx={{ color: "error.main", fontWeight: 500 }}>
          {actualStart
            ? `Live since ${formatTimestamp(actualStart, timezone)}`
            : "Live Now"}
        </Box>
      );
    case "past":
    case "missing":
      return <>Published at {formatTimestamp(availableAt, timezone)}</>;
    default:
      warnOnce("unknown status", status);
      return <>Published at {formatTimestamp(availableAt, timezone)}</>;
  }
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/StatusText.tsx
git commit -m "feat: StatusText component for video status display"
```

---

## Task 12: VideoCard component (`src/components/VideoCard.tsx`)

**Files:**
- Create: `src/components/VideoCard.tsx`

### Steps

- [ ] **Step 1: Write `src/components/VideoCard.tsx`**

```tsx
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "@tanstack/react-router";
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
import { StatusText } from "./StatusText";

interface VideoCardProps {
  video: VideoSummary | VideoSummaryWithoutChannel;
  channel: ChannelRef;
  hideChannel?: boolean;
}

export function VideoCard({ video, channel, hideChannel = false }: VideoCardProps) {
  const [timezone] = useTimezonePref();
  const isLegacy = video.archiveVersion < 2;
  const thumbnailSrc = getYouTubeThumbnail(video.id);

  const thumbnailContent = (
    <Box sx={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
      <Box
        component="img"
        src={thumbnailSrc}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {isLegacy && (
        <Chip
          label="Legacy"
          size="small"
          color="default"
          sx={{ position: "absolute", top: 8, left: 8 }}
        />
      )}
    </Box>
  );

  const titleContent = (
    <Typography
      variant="subtitle1"
      sx={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
        wordBreak: "break-word",
        lineHeight: 1.3,
        minHeight: "2.6em",
      }}
    >
      {video.title}
    </Typography>
  );

  const cardClickProps = isLegacy
    ? {
        component: "a" as const,
        href: legacyVideoHref(video, channel),
        target: "_blank",
        rel: "noopener noreferrer",
      }
    : {
        component: Link,
        to: "/videos/$videoId",
        params: { videoId: video.id },
      };

  return (
    <Card>
      <CardActionArea {...cardClickProps}>
        {thumbnailContent}
        <CardContent sx={{ pb: 1 }}>
          {titleContent}
        </CardContent>
      </CardActionArea>
      <CardContent sx={{ pt: 0, pb: 1 }}>
        {!hideChannel && (
          <Box
            component={Link}
            to="/channels/$channelId"
            params={{ channelId: channel.id }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              textDecoration: "none",
              color: "inherit",
              mb: 0.5,
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Avatar
              src={channel.avatarUrl}
              alt=""
              imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
              sx={{ width: 24, height: 24 }}
            />
            <Typography variant="body2" noWrap>
              {channel.name}
            </Typography>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" component="div">
          <StatusText
            status={video.status}
            scheduledStart={video.scheduledStart}
            actualStart={video.actualStart}
            availableAt={video.availableAt}
            timezone={timezone}
          />
        </Typography>
      </CardContent>
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
          fontSize: "0.8125rem",
          color: "text.secondary",
        }}
      >
        <Stack direction="row" spacing={1} divider={<Box>·</Box>}>
          <span>SC: {formatCurrency(video.stats.superChatTotalJpy, "JPY")}</span>
          <span>Members: {video.stats.memberCount.toLocaleString()}</span>
          <span>Gifts: {video.stats.giftCount.toLocaleString()}</span>
        </Stack>
      </Box>
    </Card>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS. (`Link to`/`params` type errors will appear until the
routes exist — if seen, comment out the channel chip's `to`/`params`
temporarily, then re-enable after Task 17. For Task 12 alone, prefer
to skip lint of this file with `// @ts-expect-error route tree not yet generated`
on the two `to=` lines.)

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoCard.tsx
git commit -m "feat: VideoCard component with legacy + v2 link branching"
```

---

## Task 13: TopBar component (`src/components/TopBar.tsx`)

**Files:**
- Create: `src/components/TopBar.tsx`

### Steps

- [ ] **Step 1: Write `src/components/TopBar.tsx`**

```tsx
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  AppBar,
  Box,
  Breadcrumbs,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import { Link, useMatches } from "@tanstack/react-router";
import {
  useThemePref,
  useTimezonePref,
  type ThemePref,
} from "../lib/settings";
import type { TimezonePref } from "../lib/format";

interface BreadcrumbEntry {
  label: string;
  to?: string;
}

function useBreadcrumbs(): BreadcrumbEntry[] {
  const matches = useMatches();
  const crumbs: BreadcrumbEntry[] = [{ label: "Home", to: "/" }];
  for (const m of matches) {
    const loaderData = m.loaderData as { breadcrumb?: BreadcrumbEntry } | undefined;
    if (loaderData?.breadcrumb) crumbs.push(loaderData.breadcrumb);
  }
  return crumbs;
}

const TIMEZONES: TimezonePref[] = ["local", "Asia/Tokyo", "UTC"];
const TIMEZONE_LABELS: Record<TimezonePref, string> = {
  local: "Local",
  "Asia/Tokyo": "Asia/Tokyo",
  UTC: "UTC",
};

const THEMES: ThemePref[] = ["light", "dark", "system"];
const THEME_LABELS: Record<ThemePref, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function TopBar() {
  const appBarRef = useRef<HTMLDivElement>(null);
  const [timezone, setTimezone] = useTimezonePref();
  const [theme, setTheme] = useThemePref();
  const [tzAnchor, setTzAnchor] = useState<HTMLElement | null>(null);
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const crumbs = useBreadcrumbs();

  useEffect(() => {
    const el = appBarRef.current;
    if (!el) return;
    const write = () => {
      document.documentElement.style.setProperty(
        "--topbar-h",
        `${el.offsetHeight}px`,
      );
    };
    write();
    const obs = new ResizeObserver(write);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <AppBar ref={appBarRef} position="sticky" color="default" elevation={1}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
        >
          VChat
        </Typography>
        <Breadcrumbs sx={{ flexGrow: 1, minWidth: 0 }} maxItems={4}>
          {crumbs.map((c, i) =>
            c.to ? (
              <Box
                key={i}
                component={Link}
                to={c.to}
                sx={{
                  color: "inherit",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {c.label}
              </Box>
            ) : (
              <Box
                key={i}
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 320,
                }}
              >
                {c.label}
              </Box>
            ),
          )}
        </Breadcrumbs>
        <IconButton
          onClick={(e: MouseEvent<HTMLElement>) => setTzAnchor(e.currentTarget)}
          aria-label="timezone"
        >
          <AccessTimeIcon />
        </IconButton>
        <Menu
          anchorEl={tzAnchor}
          open={Boolean(tzAnchor)}
          onClose={() => setTzAnchor(null)}
        >
          {TIMEZONES.map((tz) => (
            <MenuItem
              key={tz}
              selected={tz === timezone}
              onClick={() => {
                setTimezone(tz);
                setTzAnchor(null);
              }}
            >
              {TIMEZONE_LABELS[tz]}
            </MenuItem>
          ))}
        </Menu>
        <IconButton
          onClick={(e: MouseEvent<HTMLElement>) => setThemeAnchor(e.currentTarget)}
          aria-label="theme"
        >
          <Brightness4Icon />
        </IconButton>
        <Menu
          anchorEl={themeAnchor}
          open={Boolean(themeAnchor)}
          onClose={() => setThemeAnchor(null)}
        >
          {THEMES.map((t) => (
            <MenuItem
              key={t}
              selected={t === theme}
              onClick={() => {
                setTheme(t);
                setThemeAnchor(null);
              }}
            >
              {THEME_LABELS[t]}
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat: TopBar with breadcrumb, timezone toggle, theme toggle"
```

---

## Task 14: Bootstrap `main.tsx` + providers + router

**Files:**
- Modify: `src/main.tsx` (replace scaffolded content entirely)

### Steps

- [ ] **Step 1: Overwrite `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { lightTheme, darkTheme } from "./theme";
import { useResolvedTheme } from "./lib/settings";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();
const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function ThemedApp() {
  const mode = useResolvedTheme();
  return (
    <ThemeProvider theme={mode === "dark" ? darkTheme : lightTheme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: Note: `routeTree.gen.ts` import**

The file does not exist yet. It is generated by
`@tanstack/router-plugin/vite` at dev/build time when a `src/routes/`
tree exists. Tasks 15–17 + 23 create the routes; the generator will
emit `src/routeTree.gen.ts` automatically. For now, the typecheck will
fail; we will validate at the end of Task 15 once the root route exists.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: main.tsx wires QueryClient + Router + ThemeProvider"
```

---

## Task 15: Root route (`src/routes/__root.tsx`)

**Files:**
- Create: `src/routes/__root.tsx`

### Steps

- [ ] **Step 1: Write `src/routes/__root.tsx`**

```tsx
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Box } from "@mui/material";
import { TopBar } from "../components/TopBar";
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
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <TopBar />
      <Outlet />
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

- [ ] **Step 2: Trigger route tree generation by running dev once**

```bash
npm run dev
```

Wait until the terminal prints "VITE v… ready". This triggers
`@tanstack/router-plugin/vite` to write `src/routeTree.gen.ts`.
Then press `q` to stop the dev server. Confirm:

```bash
ls -la src/routeTree.gen.ts
```

Expected: file exists.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS (`main.tsx`'s `./routeTree.gen` import now resolves).
If the Index route does not yet exist the build may still complain;
proceed to Task 16.

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: root route with TopBar layout + dev tools"
```

---

## Task 16: Index route (`src/routes/index.tsx`)

**Files:**
- Create: `src/routes/index.tsx`

### Steps

- [ ] **Step 1: Write `src/routes/index.tsx`**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { z } from "zod";
import { useIndexQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const indexSearchSchema = z.object({
  tab: z.enum(["live", "past"]).default("live"),
});

export const Route = createFileRoute("/")({
  validateSearch: indexSearchSchema,
  component: IndexPage,
});

function IndexPage() {
  useDocumentTitle("VChat");
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const query = useIndexQuery();

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
          <Alert severity="warning">No archive index found.</Alert>
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
          Failed to load archive index.
        </Alert>
      </Container>
    );
  }

  const data = query.data;
  const list = tab === "live" ? data.live : data.past;

  return (
    <Container sx={{ py: 2 }}>
      <Tabs
        value={tab}
        onChange={(_, value: "live" | "past") =>
          navigate({ search: { tab: value }, replace: true })
        }
        sx={{ mb: 2 }}
      >
        <Tab value="live" label={`Live / Upcoming (${data.live.length})`} />
        <Tab value="past" label={`Past (${data.past.length})`} />
      </Tabs>
      {list.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Typography color="text.secondary">
            {tab === "live" ? "No live streams" : "No past archives"}
          </Typography>
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

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:5173/`. If `VITE_DATA_PROXY` is unset or
unreachable, expect the error Alert. With a valid proxy, expect the
Live tab to render cards. Toggle the Past tab; verify URL shows
`?tab=%22past%22`. Press `q` to stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx src/routeTree.gen.ts
git commit -m "feat: index route with live/past tabs and video grid"
```

(Include `routeTree.gen.ts` in the commit only if it was regenerated;
if `.gitignore`'d it will not be added.)

---

## Task 17: ChannelHeader component + Channel route

**Files:**
- Create: `src/components/ChannelHeader.tsx`
- Create: `src/routes/channels.$channelId.tsx`

### Steps

- [ ] **Step 1: Write `src/components/ChannelHeader.tsx`**

```tsx
import { Avatar, Box, IconButton, Skeleton, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { ChannelRef } from "../api/types";

interface ChannelHeaderProps {
  channel?: ChannelRef;
  loading?: boolean;
}

export function ChannelHeader({ channel, loading }: ChannelHeaderProps) {
  if (loading || !channel) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Skeleton variant="circular" width={64} height={64} />
        <Skeleton width={240} height={36} />
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
      <Avatar
        src={channel.avatarUrl}
        alt=""
        imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
        sx={{ width: 64, height: 64 }}
      />
      <Typography variant="h4" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
        {channel.name}
      </Typography>
      <IconButton
        component="a"
        href={`https://www.youtube.com/channel/${channel.id}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="open channel on YouTube"
      >
        <OpenInNewIcon />
      </IconButton>
    </Box>
  );
}
```

- [ ] **Step 2: Write `src/routes/channels.$channelId.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Container,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";
import { useChannelQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { ChannelHeader } from "../components/ChannelHeader";
import { VideoCard } from "../components/VideoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export const Route = createFileRoute("/channels/$channelId")({
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = Route.useParams();
  const query = useChannelQuery(channelId);
  useDocumentTitle(query.data ? `${query.data.name} — VChat` : "VChat");

  if (query.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <ChannelHeader loading />
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" sx={{ aspectRatio: "16/9" }} />
              <Skeleton width="80%" />
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
          <Alert severity="warning">Channel not found.</Alert>
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
          Failed to load channel.
        </Alert>
      </Container>
    );
  }

  const data = query.data;
  return (
    <Container sx={{ py: 2 }}>
      <ChannelHeader channel={data} />
      {data.videos.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          No archives for this channel.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {data.videos.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={data} hideChannel />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
```

- [ ] **Step 3: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:5173/channels/UCxxx` with a real channel id
from your proxy. Confirm header + grid render. Press `q` to stop.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChannelHeader.tsx src/routes/channels.$channelId.tsx src/routeTree.gen.ts
git commit -m "feat: channel page route + ChannelHeader"
```

---

## Task 18: CurrencyTable component (`src/components/CurrencyTable.tsx`)

**Files:**
- Create: `src/components/CurrencyTable.tsx`

### Steps

- [ ] **Step 1: Write `src/components/CurrencyTable.tsx`**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import type { CurrencyAgg } from "../api/types";
import { formatCurrency } from "../lib/format";

interface CurrencyTableProps {
  currencies: CurrencyAgg[];
  jpyTotal: number;
}

export function CurrencyTable({ currencies, jpyTotal }: CurrencyTableProps) {
  return (
    <TableContainer sx={{ maxWidth: 480 }}>
      <Table
        size="small"
        sx={{ fontFamily: "monospace", "& td, & th": { fontFamily: "inherit" } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>code</TableCell>
            <TableCell align="right">sum</TableCell>
            <TableCell align="right">sum (JPY)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {currencies.map((c) => (
            <TableRow key={c.currency}>
              <TableCell>{c.currency}</TableCell>
              <TableCell align="right">
                {formatCurrency(c.amount, c.currency, "decimal")}
              </TableCell>
              <TableCell align="right">
                {formatCurrency(Math.round(c.jpyAmount), "JPY", "decimal")}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell />
            <TableCell />
            <TableCell align="right">
              <strong>{formatCurrency(jpyTotal, "JPY", "decimal")}</strong>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/CurrencyTable.tsx
git commit -m "feat: CurrencyTable component"
```

---

## Task 19: FilterChips component (`src/components/FilterChips.tsx`)

**Files:**
- Create: `src/components/FilterChips.tsx`

### Steps

- [ ] **Step 1: Write `src/components/FilterChips.tsx`**

```tsx
import { Box, Chip, Slider, Stack, Typography } from "@mui/material";
import type { FilterableType, VideoAggregates } from "../api/types";

const CHIPS: Array<{
  key: FilterableType;
  label: string;
  count: (agg: VideoAggregates) => string;
}> = [
  { key: "chat", label: "Chat", count: (a) => a.chatCount.toLocaleString() },
  { key: "superChat", label: "SuperChat", count: (a) => a.superChatCount.toLocaleString() },
  { key: "superSticker", label: "SuperSticker", count: (a) => a.superStickerCount.toLocaleString() },
  { key: "membership", label: "Member", count: (a) => a.membershipCount.toLocaleString() },
  { key: "membershipGift", label: "Gifts Received", count: (a) => a.giftCount.toLocaleString() },
  {
    key: "membershipGiftPurchase",
    label: "Gift Purchases",
    count: (a) =>
      `${a.giftPurchaseCount.toLocaleString()}, ${a.totalGiftAmount.toLocaleString()} gifts`,
  },
  { key: "milestone", label: "Milestone", count: (a) => a.milestoneCount.toLocaleString() },
  { key: "poll", label: "Poll", count: (a) => a.pollCount.toLocaleString() },
  { key: "raid", label: "Raid", count: (a) => a.raidCount.toLocaleString() },
];

interface FilterChipsProps {
  aggregates: VideoAggregates;
  selectedTypes: FilterableType[];
  onTypesChange: (next: FilterableType[]) => void;
  sigRange: [number, number];
  onSigRangeChange: (next: [number, number]) => void;
}

export function FilterChips(props: FilterChipsProps) {
  const { aggregates, selectedTypes, onTypesChange, sigRange, onSigRangeChange } = props;
  const selected = new Set(selectedTypes);

  const toggle = (key: FilterableType) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onTypesChange(CHIPS.filter((c) => next.has(c.key)).map((c) => c.key));
  };

  return (
    <Box sx={{ my: 2 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        {CHIPS.map((chip) => (
          <Chip
            key={chip.key}
            label={`${chip.label} (${chip.count(aggregates)})`}
            color={selected.has(chip.key) ? "primary" : "default"}
            variant={selected.has(chip.key) ? "filled" : "outlined"}
            onClick={() => toggle(chip.key)}
            clickable
          />
        ))}
      </Stack>
      <Box sx={{ mt: 3, maxWidth: 480 }}>
        <Typography variant="caption" color="text.secondary">
          Significance range (SuperChat / Sticker)
        </Typography>
        <Slider
          value={sigRange}
          min={0}
          max={7}
          step={1}
          marks
          valueLabelDisplay="auto"
          onChange={(_, raw) => {
            const v = raw as [number, number];
            const next: [number, number] =
              v[0] <= v[1] ? [v[0], v[1]] : [v[1], v[0]];
            onSigRangeChange(next);
          }}
        />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterChips.tsx
git commit -m "feat: FilterChips with type toggles + significance range slider"
```

---

## Task 20: Chat row components + RowDispatcher

**Files:**
- Create: `src/components/chat-rows/RowDispatcher.tsx`
- Create: `src/components/chat-rows/TimestampLink.tsx`
- Create: `src/components/chat-rows/ChatRowBase.tsx`
- Create: `src/components/chat-rows/ChatRow.tsx`
- Create: `src/components/chat-rows/SuperChatRow.tsx`
- Create: `src/components/chat-rows/SuperStickerRow.tsx`
- Create: `src/components/chat-rows/MembershipRow.tsx`
- Create: `src/components/chat-rows/MembershipGiftRow.tsx`
- Create: `src/components/chat-rows/MembershipGiftPurchaseRow.tsx`
- Create: `src/components/chat-rows/MilestoneRow.tsx`
- Create: `src/components/chat-rows/PollRow.tsx`
- Create: `src/components/chat-rows/RaidRow.tsx`
- Create: `src/components/chat-rows/RaidOutgoingRow.tsx`

### Steps

- [ ] **Step 1: Write `src/components/chat-rows/ChatRowBase.tsx`** (shared grid wrapper)

```tsx
import { Avatar, Box, Typography, type SxProps } from "@mui/material";
import type { ReactNode } from "react";

const GRID_TEMPLATE = "56px 180px 56px 200px 1fr";

interface ChatRowBaseProps {
  no: number;
  timestamp: ReactNode;
  photo?: string | null;
  author: ReactNode;
  body: ReactNode;
  bodySx?: SxProps;
}

export function ChatRowBase(props: ChatRowBaseProps) {
  const { no, timestamp, photo, author, body, bodySx } = props;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems: "center",
        columnGap: 1,
        py: 1,
        px: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ textAlign: "right", color: "text.secondary" }}>
        {no}
      </Typography>
      <Box>{timestamp}</Box>
      <Box>
        {photo ? (
          <Avatar
            src={photo}
            alt=""
            imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
            sx={{ width: 40, height: 40 }}
          />
        ) : null}
      </Box>
      <Typography variant="body2" noWrap>
        {author}
      </Typography>
      <Box sx={bodySx}>{body}</Box>
    </Box>
  );
}
```

- [ ] **Step 2: Write `src/components/chat-rows/TimestampLink.tsx`**

```tsx
import type { VideoMeta } from "../../api/types";
import { formatTimestamp, getYouTubeUrl, type TimezonePref } from "../../lib/format";

interface TimestampLinkProps {
  timestamp: string;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function TimestampLink({ timestamp, video, timezone }: TimestampLinkProps) {
  const display = formatTimestamp(timestamp, timezone);
  if (video.actualStart && timestamp >= video.actualStart) {
    const t = Math.floor(
      (Date.parse(timestamp) - Date.parse(video.actualStart)) / 1000,
    );
    return (
      <a
        href={getYouTubeUrl(video.id, t)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit" }}
      >
        {display}
      </a>
    );
  }
  return <span>{display}</span>;
}
```

- [ ] **Step 3: Write `src/components/chat-rows/ChatRow.tsx`**

```tsx
import type { ChatRowChat, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

const AUTHOR_BORDER: Record<string, string> = {
  owner: "#00984f",
  moderator: "#5e84f1",
  verified: "#888",
};

interface Props {
  row: ChatRowChat;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function ChatRow({ row, no, video, timezone }: Props) {
  const border = AUTHOR_BORDER[row.authorType];
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={row.message}
      bodySx={border ? { borderLeft: `4px solid ${border}`, pl: 1 } : undefined}
    />
  );
}
```

- [ ] **Step 4: Write `src/components/chat-rows/SuperChatRow.tsx`**

```tsx
import { Box, Typography } from "@mui/material";
import type { ChatRowSuperChat, VideoMeta } from "../../api/types";
import { formatCurrency, type TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowSuperChat;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function SuperChatRow({ row, no, video, timezone }: Props) {
  const amount =
    row.currency === "JPY"
      ? formatCurrency(row.jpyAmount, "JPY")
      : `${formatCurrency(row.amount, row.currency)} (${formatCurrency(row.jpyAmount, "JPY")})`;

  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 8,
              minHeight: 24,
              bgcolor: row.color ?? "transparent",
              borderRadius: 0.5,
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {amount}
          </Typography>
          {row.message !== null ? (
            <Typography variant="body2">{row.message}</Typography>
          ) : (
            <Typography variant="body2" sx={{ fontStyle: "italic", color: "primary.main" }}>
              (wordless superchat)
            </Typography>
          )}
        </Box>
      }
    />
  );
}
```

- [ ] **Step 5: Write `src/components/chat-rows/SuperStickerRow.tsx`**

```tsx
import { Box, Typography } from "@mui/material";
import type { ChatRowSuperSticker, VideoMeta } from "../../api/types";
import { formatCurrency, type TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowSuperSticker;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function SuperStickerRow({ row, no, video, timezone }: Props) {
  const amount =
    row.currency === "JPY"
      ? formatCurrency(row.jpyAmount, "JPY")
      : `${formatCurrency(row.amount, row.currency)} (${formatCurrency(row.jpyAmount, "JPY")})`;

  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 8,
              minHeight: 24,
              bgcolor: row.color ?? "transparent",
              borderRadius: 0.5,
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {amount}
          </Typography>
          <Box
            component="img"
            src={row.image}
            alt={row.text ?? "sticker"}
            title={row.text ?? ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            sx={{ maxHeight: 48 }}
          />
        </Box>
      }
    />
  );
}
```

- [ ] **Step 6: Write `src/components/chat-rows/MembershipRow.tsx`**

```tsx
import { Box } from "@mui/material";
import type { ChatRowMembership, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowMembership;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function MembershipRow({ row, no, video, timezone }: Props) {
  const label = row.level ?? row.membership ?? "N/A";
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ borderLeft: "4px solid #00984f", pl: 1 }}>
          Joined as a member ({label})
        </Box>
      }
    />
  );
}
```

- [ ] **Step 7: Write `src/components/chat-rows/MembershipGiftRow.tsx`**

```tsx
import { Box } from "@mui/material";
import type { ChatRowMembershipGift, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowMembershipGift;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function MembershipGiftRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ borderLeft: "4px solid #00984f", pl: 1 }}>
          Received a membership gift from {row.senderName ?? "N/A"}
        </Box>
      }
    />
  );
}
```

- [ ] **Step 8: Write `src/components/chat-rows/MembershipGiftPurchaseRow.tsx`**

```tsx
import { Box } from "@mui/material";
import type { ChatRowMembershipGiftPurchase, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowMembershipGiftPurchase;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function MembershipGiftPurchaseRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ borderLeft: "4px solid #00984f", pl: 1 }}>
          Purchased {row.amount} membership gift(s)
        </Box>
      }
    />
  );
}
```

- [ ] **Step 9: Write `src/components/chat-rows/MilestoneRow.tsx`**

```tsx
import { Box, Typography } from "@mui/material";
import type { ChatRowMilestone, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowMilestone;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function MilestoneRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ borderLeft: "4px solid #00984f", pl: 1 }}>
          {row.message !== null ? (
            row.message
          ) : (
            <Typography component="span" sx={{ fontStyle: "italic", color: "primary.main" }}>
              (wordless milestone)
            </Typography>
          )}
        </Box>
      }
    />
  );
}
```

- [ ] **Step 10: Write `src/components/chat-rows/PollRow.tsx`**

```tsx
import { Box } from "@mui/material";
import type { ChatRowPoll, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowPoll;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function PollRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={null}
      author="Poll"
      body={
        <Box>
          {row.voteCount !== undefined && <div>{row.voteCount} votes</div>}
          <div>{row.question ?? "(empty question)"}</div>
          {row.choices.map((choice, i) => {
            const pct =
              choice.voteRatio !== undefined
                ? ` (${Math.floor(choice.voteRatio * 1000) / 10}%)`
                : "";
            return <div key={i}>{`- ${choice.text}${pct}`}</div>;
          })}
        </Box>
      }
    />
  );
}
```

- [ ] **Step 11: Write `src/components/chat-rows/RaidRow.tsx`**

```tsx
import type { ChatRowRaid, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowRaid;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function RaidRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.sourcePhoto ?? null}
      author="Raid (incoming)"
      body={`${row.sourceName} and their viewers just joined. Say hello!`}
    />
  );
}
```

- [ ] **Step 12: Write `src/components/chat-rows/RaidOutgoingRow.tsx`**

```tsx
import type { ChatRowRaidOutgoing, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowRaidOutgoing;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function RaidOutgoingRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink timestamp={row.timestamp} video={video} timezone={timezone} />}
      photo={row.originPhoto ?? null}
      author="Raid (outgoing)"
      body={`Sending you to ${row.originName ?? ""}`}
    />
  );
}
```

- [ ] **Step 13: Write `src/components/chat-rows/RowDispatcher.tsx`**

```tsx
import type { ChatRow, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRow as ChatRowComponent } from "./ChatRow";
import { SuperChatRow } from "./SuperChatRow";
import { SuperStickerRow } from "./SuperStickerRow";
import { MembershipRow } from "./MembershipRow";
import { MembershipGiftRow } from "./MembershipGiftRow";
import { MembershipGiftPurchaseRow } from "./MembershipGiftPurchaseRow";
import { MilestoneRow } from "./MilestoneRow";
import { PollRow } from "./PollRow";
import { RaidRow } from "./RaidRow";
import { RaidOutgoingRow } from "./RaidOutgoingRow";

interface Props {
  row: ChatRow;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function RowDispatcher({ row, no, video, timezone }: Props) {
  switch (row.type) {
    case "chat":
      return <ChatRowComponent row={row} no={no} video={video} timezone={timezone} />;
    case "superChat":
      return <SuperChatRow row={row} no={no} video={video} timezone={timezone} />;
    case "superSticker":
      return <SuperStickerRow row={row} no={no} video={video} timezone={timezone} />;
    case "membership":
      return <MembershipRow row={row} no={no} video={video} timezone={timezone} />;
    case "membershipGift":
      return <MembershipGiftRow row={row} no={no} video={video} timezone={timezone} />;
    case "membershipGiftPurchase":
      return <MembershipGiftPurchaseRow row={row} no={no} video={video} timezone={timezone} />;
    case "milestone":
      return <MilestoneRow row={row} no={no} video={video} timezone={timezone} />;
    case "poll":
      return <PollRow row={row} no={no} video={video} timezone={timezone} />;
    case "raid":
      return <RaidRow row={row} no={no} video={video} timezone={timezone} />;
    case "raidOutgoing":
      return <RaidOutgoingRow row={row} no={no} video={video} timezone={timezone} />;
  }
}
```

- [ ] **Step 14: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 15: Commit**

```bash
git add src/components/chat-rows/
git commit -m "feat: 10 chat-row components + RowDispatcher + shared base"
```

---

## Task 21: ChatList virtualizer (`src/components/ChatList.tsx`)

**Files:**
- Create: `src/components/ChatList.tsx`

### Steps

- [ ] **Step 1: Write `src/components/ChatList.tsx`**

```tsx
import { useEffect, useMemo, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatRow, FilterableType, VideoMeta } from "../api/types";
import type { TimezonePref } from "../lib/format";
import { CHATLIST_PAD_PX } from "../theme";
import { RowDispatcher } from "./chat-rows/RowDispatcher";

interface ChatListProps {
  rows: ChatRow[];
  video: VideoMeta;
  selectedTypes: FilterableType[];
  sigRange: [number, number];
  timezone: TimezonePref;
  headerHeight: number;
}

export function ChatList(props: ChatListProps) {
  const { rows, video, selectedTypes, sigRange, timezone, headerHeight } = props;

  const filtered = useMemo<ChatRow[]>(() => {
    const typeSet = new Set<FilterableType>(selectedTypes);
    const raidGroup = typeSet.has("raid");
    return rows.filter((row) => {
      if (row.type === "raidOutgoing") return raidGroup;
      if (!typeSet.has(row.type)) return false;
      if (row.type === "superChat" || row.type === "superSticker") {
        const sig = row.significance ?? 0;
        return sig >= sigRange[0] && sig <= sigRange[1];
      }
      return true;
    });
  }, [rows, selectedTypes, sigRange]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--chatlist-height",
      `calc(100vh - var(--topbar-h, 64px) - ${headerHeight}px - ${CHATLIST_PAD_PX}px)`,
    );
  }, [headerHeight]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  if (selectedTypes.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography color="text.secondary">No row types selected</Typography>
      </Box>
    );
  }

  if (filtered.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography color="text.secondary">No rows match the current filters</Typography>
      </Box>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <Box
      ref={containerRef}
      sx={{
        height: "var(--chatlist-height)",
        overflow: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <Box sx={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {items.map((item) => (
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
            <RowDispatcher
              row={filtered[item.index]}
              no={item.index + 1}
              video={video}
              timezone={timezone}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatList.tsx
git commit -m "feat: ChatList virtualizer with type+sigRange filtering"
```

---

## Task 22: VideoHeader component (`src/components/VideoHeader.tsx`)

**Files:**
- Create: `src/components/VideoHeader.tsx`

### Steps

- [ ] **Step 1: Write `src/components/VideoHeader.tsx`**

```tsx
import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";
import { Link } from "@tanstack/react-router";
import type { VideoMeta } from "../api/types";
import { getYouTubeThumbnail, getYouTubeUrl, type TimezonePref } from "../lib/format";
import { StatusText } from "./StatusText";

interface VideoHeaderProps {
  video: VideoMeta;
  timezone: TimezonePref;
}

export function VideoHeader({ video, timezone }: VideoHeaderProps) {
  const ytUrl = getYouTubeUrl(video.id);
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
      <Box
        component="a"
        href={ytUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ flexShrink: 0, display: "block", width: 240, aspectRatio: "16/9" }}
      >
        <Box
          component="img"
          src={getYouTubeThumbnail(video.id)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </Box>
      <Stack spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="h5"
          component="a"
          href={ytUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "inherit", textDecoration: "none" }}
        >
          {video.title}
        </Typography>
        <Box>
          <Chip
            component={Link}
            to="/channels/$channelId"
            params={{ channelId: video.channel.id }}
            clickable
            avatar={
              <Avatar
                src={video.channel.avatarUrl}
                imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
              />
            }
            label={video.channel.name}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          <StatusText
            status={video.status}
            scheduledStart={video.scheduledStart}
            actualStart={video.actualStart}
            availableAt={video.availableAt}
            timezone={timezone}
          />
        </Typography>
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoHeader.tsx
git commit -m "feat: VideoHeader component"
```

---

## Task 23: Video route (`src/routes/videos.$videoId.tsx`)

**Files:**
- Create: `src/routes/videos.$videoId.tsx`

### Steps

- [ ] **Step 1: Write `src/routes/videos.$videoId.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Skeleton,
  Typography,
} from "@mui/material";
import { z } from "zod";
import { useVideoMetaQuery, useVideoRowsQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoHeader } from "../components/VideoHeader";
import { CurrencyTable } from "../components/CurrencyTable";
import { FilterChips } from "../components/FilterChips";
import { ChatList } from "../components/ChatList";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useTimezonePref } from "../lib/settings";
import { legacyVideoHref } from "../lib/format";
import type { FilterableType } from "../api/types";

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
    .tuple([z.number().int().min(0).max(7), z.number().int().min(0).max(7)])
    .refine(([lo, hi]) => lo <= hi, { message: "lo must be <= hi" })
    .optional(),
});

export const Route = createFileRoute("/videos/$videoId")({
  validateSearch: videoSearchSchema,
  component: VideoPage,
});

const DEFAULT_TYPES: FilterableType[] = ["superChat", "superSticker"];
const DEFAULT_SIG_RANGE: [number, number] = [1, 7];

function VideoPage() {
  const { videoId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/videos/$videoId" });
  const [timezone] = useTimezonePref();

  const meta = useVideoMetaQuery(videoId);
  const rows = useVideoRowsQuery(videoId);

  useDocumentTitle(meta.data ? `${meta.data.title} — VChat` : "VChat");

  const selectedTypes = search.types ?? DEFAULT_TYPES;
  const sigRange = search.sigRange ?? DEFAULT_SIG_RANGE;

  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const write = () => setHeaderHeight(el.offsetHeight);
    write();
    const obs = new ResizeObserver(write);
    obs.observe(el);
    return () => obs.disconnect();
  }, [meta.data]);

  if (meta.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <Skeleton variant="rectangular" height={160} sx={{ mb: 2 }} />
        <Skeleton width={400} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
      </Container>
    );
  }

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
      <Container sx={{ py: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => meta.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Failed to load video.
        </Alert>
      </Container>
    );
  }

  const video = meta.data;
  if (video.archiveVersion < 2) {
    return (
      <Container sx={{ py: 2 }}>
        <Alert
          severity="warning"
          action={
            <Button
              component="a"
              href={legacyVideoHref(video, video.channel)}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
            >
              Open legacy archive
            </Button>
          }
        >
          This archive predates the JSON format.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box ref={headerRef}>
        <VideoHeader video={video} timezone={timezone} />
        <CurrencyTable
          currencies={video.aggregates.currencyTable}
          jpyTotal={video.aggregates.jpyTotal}
        />
        <FilterChips
          aggregates={video.aggregates}
          selectedTypes={selectedTypes}
          onTypesChange={(next) =>
            navigate({ search: { ...search, types: next }, replace: true })
          }
          sigRange={sigRange}
          onSigRangeChange={(next) =>
            navigate({ search: { ...search, sigRange: next }, replace: true })
          }
        />
      </Box>
      {rows.isPending ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">Loading chat…</Typography>
        </Box>
      ) : rows.isError ? (
        rows.error instanceof NotFoundError ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              No chat rows archived for this video
            </Typography>
          </Box>
        ) : (
          <Alert
            severity="error"
            action={
              <Button onClick={() => rows.refetch()} size="small">
                Retry
              </Button>
            }
            sx={{ my: 2 }}
          >
            Failed to load chat rows.
          </Alert>
        )
      ) : (
        <ChatList
          rows={rows.data}
          video={video}
          selectedTypes={selectedTypes}
          sigRange={sigRange}
          timezone={timezone}
          headerHeight={headerHeight}
        />
      )}
    </Container>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:5173/videos/{realVideoId}` with a v2-archived
video. Confirm header, currency table, filter chips, and chat list
render. Toggle chips; URL updates. Drag the slider; rows filter.
Resize the window; the chat list scroll area resizes. Press `q` to stop.

- [ ] **Step 4: Commit**

```bash
git add src/routes/videos.$videoId.tsx src/routeTree.gen.ts
git commit -m "feat: video page route wiring header, currency, chips, chat list"
```

---

## Task 24: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

### Steps

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy SPA to S3

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - run: npm run lint

      - run: npm run typecheck

      - run: npm run build

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Sync dist/ to S3 (excluding honeybee-owned /data)
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}/ \
            --delete \
            --exclude "data/*"

      - name: Invalidate CloudFront for SPA paths
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DIST_ID }} \
            --paths "/index.html" "/assets/*"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions deploy to S3 via OIDC + CloudFront invalidation"
```

---

## Task 25: Final integration build

**Files:** none (verification only)

### Steps

- [ ] **Step 1: Full clean build**

```bash
rm -rf dist src/routeTree.gen.ts node_modules/.cache
npm run typecheck
npm run lint
npm run build
```

Expected: all three pass. `dist/` exists with `index.html`, `assets/`,
and no `data/` directory.

- [ ] **Step 2: Preview the built SPA against a real data source**

```bash
VITE_DATA_PROXY=https://your-staging.example.com npm run preview
```

Visit `http://localhost:4173/`. Walk through verification §10 steps
1–4, 7–9, 12–13 manually (the rest require a real S3+CloudFront
deployment). Verify no console errors other than expected `[vchat]`
warnings.

- [ ] **Step 3: Commit any incidental cleanups**

If any final lint/format fixes are needed, commit them:

```bash
git add -A
git commit -m "chore: post-integration cleanup"
```

Otherwise, skip the commit.

---

## Out of plan / out of scope

The following items are explicitly **not** part of this plan and will
not be executed:

- AWS infrastructure (S3 bucket creation, CloudFront distribution +
  spa-rewrite function, OIDC trust policy). Operator setup is
  documented in spec §5.4 and §9.3.
- Provisioning `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET`,
  `CF_DIST_ID` GitHub secrets.
- Full §10 verification on a real S3+CloudFront deployment (steps 4,
  5, 6, 10, 11, 14–22). This is the post-merge acceptance gate, run
  by the operator after first deploy.
- Web Worker JSONL parser (see spec §1 out-of-scope item).
- Unit tests (see spec §11).
