# Gift Row Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-codex:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read, render, and filter honeybee's `gift` archive row (YouTube Gifts bought with Jewels), and rename the existing membership-gift UI labels so the two notions of "gift" stop colliding.

**Architecture:** Reader-only change following the repo's one-component-per-row-type pattern. `ChatRowGift` joins the `ChatRow` union, `parseJSONL` stops discarding the type, a new `GiftRow` component renders it, and the filterable-row-type set collapses from three hand-written lists into one `FILTERABLE_TYPES` tuple that feeds both the route's zod enum and the chip record.

**Tech Stack:** React 19, TypeScript 6.0.3, zod 4.4.3, MUI v6, TanStack Router/Query/Virtual, Vite. No test framework exists in this repo — `npm run typecheck` and `npm run lint` are the automated gates, plus a manual dev-server pass.

**Spec:** [docs/superpowers/specs/2026-08-12-gift-row-type-design.md](../specs/2026-08-12-gift-row-type-design.md)

---

## Background an engineer needs before starting

**What a gift row is.** honeybee archives one YouTube Gift per JSONL line. `amount` is the Jewels price of *one* gift, never a combo total, and it is absent when honeybee's price table did not yet know that asset. `currency` is always the literal `"JEWEL"` — which is **not** a 3-letter ISO 4217 code, so the repo's `formatCurrency` (which calls `Intl` with `style: "currency"`) would throw `RangeError` on it. That is why this plan adds a separate `formatJewels`.

**Why the render guards look paranoid.** [src/lib/jsonl.ts](../../../src/lib/jsonl.ts) validates only the `type` discriminator and then does `raw as T`. Every other field on every row type is an unchecked claim. So `amount?: number` may actually arrive as `null`, `"10"`, or `NaN` at runtime. `ChatList` renders inside `@tanstack/react-virtual`, so one throwing row takes down the whole list, not just itself. The guards in Task 2 are scoped deliberately: only the fields this change introduces. Guarding the shared author fields (`timestamp`, `authorName`, `authorPhoto`) is an explicit accepted limitation in the spec §3 — do **not** add guards for those.

**Why `FILTERABLE_TYPES` exists.** Before this change the filterable set was written out three times (`FilterableType`, the route's `filterableTypeEnum`, and `CHIPS`). Only `RowDispatcher` was compiler-gated, so a row type could ship parsed and rendered with no chip and a URL that zod rejects — and typecheck would stay green. Tasks 3–5 make all three derive from one tuple with two complementary compile-time checks.

**File structure after this plan:**

| File | Responsibility | Change |
| --- | --- | --- |
| `src/api/types.ts` | Payload shapes + the canonical filterable-type tuple | Modify (Tasks 2, 3) |
| `src/lib/jsonl.ts` | JSONL parse + `type` allow-list | Modify (Task 2) |
| `src/lib/format.ts` | Display formatting helpers | Modify (Task 1) |
| `src/components/chat-rows/GiftRow.tsx` | Render one `gift` row | **Create** (Task 2) |
| `src/components/chat-rows/RowDispatcher.tsx` | `type` → component switch | Modify (Task 2) |
| `src/routes/videos.$videoId.tsx` | Route + search-param schema | Modify (Tasks 2, 4) |
| `src/components/FilterChips.tsx` | Chip list + significance slider | Modify (Tasks 5, 6) |
| `src/components/VideoCard.tsx` | Video card footer stats | Modify (Task 7) |

---

### Task 1: `formatJewels` display helper

**Files:**
- Modify: `src/lib/format.ts` (append after `formatSuperAmount`, around line 80)
- Test: none — this repo has no test framework

- [ ] **Step 1: Append the helper to `src/lib/format.ts`**

Add this directly below the existing `formatSuperAmount` function:

```ts
// YouTube Gifts are priced in Jewels, whose `currency` code is the literal
// "JEWEL". That is not a 3-letter ISO 4217 code, so formatCurrency (which
// calls Intl with style: "currency") throws RangeError on it. Format the
// bare number and append the gem glyph instead.
export function formatJewels(amount: number): string {
  return `${amount.toLocaleString("en-US")} 💎`;
}
```

- [ ] **Step 2: Verify typecheck and lint pass**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0 with no errors. `formatJewels` is exported but not yet imported anywhere — that is fine, unused *exports* are not flagged.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat(format): add formatJewels for the non-ISO JEWEL currency"
```

---

### Task 2: `gift` row type end to end (type → parser → component → dispatcher)

These five files must land in one commit: adding `ChatRowGift` to the union makes `RowDispatcher`'s `never` branch fail typecheck, so splitting this task would commit a repo that does not compile. Steps 1–2 deliberately observe that failure before fixing it.

Two of the five are compiler-forced, not optional. `RowDispatcher` is the obvious one. The second is easy to miss: `FilterableType` is *derived* from `ChatRow["type"]`, so widening the union also widens `FilterableType`, and the route's hand-written `filterableTypeEnum` — which does not list `"gift"` — stops typing the `types` search param widely enough to satisfy `FilterChips` / `ChatList`. Step 6 adds a **one-line stopgap** there; Task 4 deletes that whole literal and derives it from `FILTERABLE_TYPES`. The stopgap exists so that no commit in the history fails to compile — it is deliberate, temporary, and superseded two tasks later.

**Files:**
- Modify: `src/api/types.ts` (insert after `ChatRowSuperSticker`, currently lines 29-38; union at lines 94-104; `VideoAggregates` at lines 170-183)
- Modify: `src/lib/jsonl.ts:4-17`
- Create: `src/components/chat-rows/GiftRow.tsx`
- Modify: `src/components/chat-rows/RowDispatcher.tsx`
- Modify: `src/routes/videos.$videoId.tsx` (one-line stopgap in `filterableTypeEnum`; removed by Task 4)
- Test: none — this repo has no test framework

- [ ] **Step 1: Add `ChatRowGift` and wire it into the union in `src/api/types.ts`**

Insert this interface immediately after `ChatRowSuperSticker` (which ends at the line before `export interface ChatRowMembership`):

```ts
export interface ChatRowGift extends AuthorFields {
  type: "gift";
  giftName?: string; // display name; absent outside the English locale
  assetName?: string; // gift image file name, e.g. "finger_heart"
  image?: string; // gift image URL
  amount?: number; // Jewels for this ONE gift; absent when the price is unknown
  currency: string; // always "JEWEL"
}
```

Then add it to the `ChatRow` union in the same position, so the union reads:

```ts
export type ChatRow =
  | ChatRowChat
  | ChatRowSuperChat
  | ChatRowSuperSticker
  | ChatRowGift
  | ChatRowMembership
  | ChatRowMembershipGift
  | ChatRowMembershipGiftPurchase
  | ChatRowMilestone
  | ChatRowPoll
  | ChatRowRaid
  | ChatRowRaidOutgoing;
```

Finally, in `VideoAggregates`, annotate the existing `giftCount` and add the new count. The `giftCount` line currently reads `giftCount: number;` — replace it and the surrounding block so it reads:

```ts
  giftCount: number; // membership gifts, NOT Jewels gifts
  giftPurchaseCount: number;
  totalGiftAmount: number;
  jewelGiftCount?: number; // gift rows; since archive v2 r1
```

`jewelGiftCount` is optional because meta files written before archive v2 r1 lack it. Their companion `.jsonl` cannot contain `gift` rows either — row type and aggregate landed in the same revision — so treating an absent value as `0` is exact, not a guess.

- [ ] **Step 2: Run typecheck and confirm it FAILS at the exhaustiveness gate**

```bash
npm run typecheck
```

Expected: FAIL. `src/components/chat-rows/RowDispatcher.tsx` errors on the `never` branch, e.g.:

```
src/components/chat-rows/RowDispatcher.tsx(45,13): error TS2322: Type 'ChatRowGift' is not assignable to type 'never'.
```

This is the safety net working: the compiler refuses to let a row type be parsed without being rendered. If typecheck instead passes here, the union edit did not take — stop and re-check Step 1.

- [ ] **Step 3: Allow `"gift"` through the parser in `src/lib/jsonl.ts`**

Replace the `rowTypeSchema` enum so `"gift"` sits in the same position as in the type union:

```ts
const rowTypeSchema = z.object({
  type: z.enum([
    "chat",
    "superChat",
    "superSticker",
    "gift",
    "membership",
    "membershipGift",
    "membershipGiftPurchase",
    "milestone",
    "poll",
    "raid",
    "raidOutgoing",
  ]),
});
```

Nothing else in this file changes — the parser still validates only `type` and casts the rest.

- [ ] **Step 4: Create `src/components/chat-rows/GiftRow.tsx`**

```tsx
import { Box, Typography } from "@mui/material";
import type { ChatRowGift, VideoMeta } from "../../api/types";
import { formatJewels, type TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowGift;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function GiftRow({ row, no, video, timezone }: Props) {
  // parseJSONL validates only the `type` discriminator and casts the rest, so
  // these declared-optional fields are contract claims, not checked facts.
  // Guard at the render boundary: `amount.toLocaleString()` on a non-number
  // throws, and inside the virtualized list that takes down the whole chat,
  // not one row. A non-string `image` would not throw but would fire a bogus
  // request for a coerced src such as "[object Object]".
  const amount =
    typeof row.amount === "number" && Number.isFinite(row.amount)
      ? row.amount
      : undefined;
  const name =
    typeof row.giftName === "string"
      ? row.giftName
      : typeof row.assetName === "string"
        ? row.assetName
        : "Gift";
  const image = typeof row.image === "string" ? row.image : undefined;

  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {amount !== undefined ? (
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              {formatJewels(amount)}
            </Typography>
          ) : null}
          {image !== undefined ? (
            <Box
              component="img"
              src={image}
              alt={name}
              title={name}
              loading="lazy"
              referrerPolicy="no-referrer"
              sx={{ maxHeight: 48 }}
            />
          ) : null}
          <Typography variant="body2">{name}</Typography>
        </Box>
      }
    />
  );
}
```

Note what is deliberately absent: no `ColorBadge` (a gift row has no `color`) and no left accent border (`authorType` is always `"other"`, so there is no badge state to express). `authorChannelId` is not read — it is an empty string on most gift rows and the author cell renders `authorName` only, with no channel link.

- [ ] **Step 5: Wire the case into `src/components/chat-rows/RowDispatcher.tsx`**

Add the import alongside the other row imports:

```tsx
import { GiftRow } from "./GiftRow";
```

Add the case after `superSticker`, matching the union order:

```tsx
    case "gift":
      return <GiftRow row={row} no={no} video={video} timezone={timezone} />;
```

- [ ] **Step 6: Add the one-line stopgap to the route's search-param enum**

Widening `ChatRow` widened the derived `FilterableType`, so the route's hand-written `filterableTypeEnum` in `src/routes/videos.$videoId.tsx` now types `types` too narrowly and fails at the `FilterChips` / `ChatList` call sites with:

```text
src/routes/videos.$videoId.tsx(130,36): error TS2322: Type 'FilterableType[]' is not assignable to type '("chat" | "superChat" | ...)[]'.
    Type '"gift"' is not assignable to type '"chat" | "superChat" | ...'.
```

Add `"gift"` in union position, and nothing else:

```diff
 const filterableTypeEnum = z.enum([
   "chat",
   "superChat",
   "superSticker",
+  "gift",
   "membership",
   "membershipGift",
   "membershipGiftPurchase",
```

Do **not** refactor this enum here. Task 4 replaces the whole literal with `z.enum(FILTERABLE_TYPES)`; this line is a deliberate stopgap that keeps every commit compilable in between.

- [ ] **Step 7: Run typecheck and lint, confirm both pass**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0. The `never` error from Step 2 and the TS2322 from Step 6 are both gone.

- [ ] **Step 8: Commit**

```bash
git add src/api/types.ts src/lib/jsonl.ts src/components/chat-rows/GiftRow.tsx src/components/chat-rows/RowDispatcher.tsx "src/routes/videos.\$videoId.tsx"
git commit -m "feat(chat-rows): parse and render the gift row type"
```

---

### Task 3: `FILTERABLE_TYPES` single source

**Files:**
- Modify: `src/api/types.ts:106` (the `FilterableType` line)
- Test: none — this repo has no test framework

- [ ] **Step 1: Replace the lone `FilterableType` line with the tuple and its two guards**

The file currently has one line:

```ts
export type FilterableType = Exclude<ChatRow["type"], "raidOutgoing">;
```

Replace it with:

```ts
export type FilterableType = Exclude<ChatRow["type"], "raidOutgoing">;

// Canonical filterable row types, in chip / URL order. Single source for the
// chip record in FilterChips and the `types` search-param enum in the video
// route — keep new row types in sync HERE, not in three places.
export const FILTERABLE_TYPES = [
  "chat",
  "superChat",
  "superSticker",
  "gift",
  "membership",
  "membershipGift",
  "membershipGiftPurchase",
  "milestone",
  "poll",
  "raid",
] as const satisfies readonly FilterableType[];

// Two complementary compile-time checks:
//   `satisfies` above rejects an entry that is not a filterable row type
//   (a typo, or "raidOutgoing").
//   The assertion below rejects a filterable row type the tuple FORGOT: the
//   Exclude resolves to the missing member, which fails `extends never`, and
//   tsc names it in the error.
type AssertNever<T extends never> = T;
export type FilterableTypesAreExhaustive = AssertNever<
  Exclude<FilterableType, (typeof FILTERABLE_TYPES)[number]>
>;
```

The constraint `T extends never` is what does the work; the alias body just has to *use* `T`. Do not write the parameter as `_T` and discard it — `@typescript-eslint/no-unused-vars` flags an unused type parameter even when underscore-prefixed, and this repo's `eslint.config.js` sets no `varsIgnorePattern` override, so `npm run lint` fails with `'_T' is defined but never used`.

`FilterableTypesAreExhaustive` is exported so it is not an unused local declaration under the same rule. It has no runtime footprint — it is a type alias.

- [ ] **Step 2: Prove the exhaustiveness guard actually fires**

Temporarily delete the `"gift",` line from `FILTERABLE_TYPES`, then:

```bash
npm run typecheck
```

Expected: FAIL, naming the missing member, e.g.:

```
src/api/types.ts(...): error TS2344: Type '"gift"' does not satisfy the constraint 'never'.
```

Restore the `"gift",` line before continuing. If typecheck passed with the line removed, the guard is not wired correctly — re-check Step 1.

- [ ] **Step 3: Run typecheck and lint on the restored file**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/api/types.ts
git commit -m "feat(types): add FILTERABLE_TYPES as the single filterable-type source"
```

---

### Task 4: Derive the route's search-param enum from the tuple

**Files:**
- Modify: `src/routes/videos.$videoId.tsx:19` (import) and `:23-33` (the enum)
- Test: none — this repo has no test framework

- [ ] **Step 1: Widen the import on line 19**

It currently reads:

```ts
import type { FilterableType } from "../api/types";
```

Replace with a mixed value/type import (this repo does not set `verbatimModuleSyntax`, so inline `type` modifiers are the convention):

```ts
import { FILTERABLE_TYPES, type FilterableType } from "../api/types";
```

- [ ] **Step 2: Replace the hand-written zod enum**

Delete this whole block — including the `"gift"` stopgap Task 2 Step 6 added to it:

```ts
const filterableTypeEnum = z.enum([
  "chat",
  "superChat",
  "superSticker",
  "gift",
  "membership",
  "membershipGift",
  "membershipGiftPurchase",
  "milestone",
  "poll",
  "raid",
]);
```

Replace it with:

```ts
const filterableTypeEnum = z.enum(FILTERABLE_TYPES);
```

This is verified against the installed zod 4.4.3: `node_modules/zod/v4/classic/schemas.d.ts:567` declares `_enum<const T extends readonly string[]>(values: T, …): ZodEnum<util.ToEnum<T[number]>>`, so a readonly `as const` tuple hits that overload and `z.infer` yields the literal union. `z.array(...)` and `.optional()` compose over it without widening to `string`, so `videoSearchSchema` needs no other edit.

`DEFAULT_TYPES` stays `["superChat", "superSticker"]` — `gift` is deliberately not a default (spec §3).

- [ ] **Step 3: Run typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0. If `types` in the search schema had silently widened to `string[]`, `selectedTypes` would fail to satisfy `FilterableType[]` where it is passed to `FilterChips` / `ChatList` — a clean pass means the literal union survived.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/videos.\$videoId.tsx"
git commit -m "refactor(routes): derive the types search-param enum from FILTERABLE_TYPES"
```

---

### Task 5: Exhaustive chip record + the Gift chip

**Files:**
- Modify: `src/components/FilterChips.tsx:1-57`
- Test: none — this repo has no test framework

- [ ] **Step 1: Replace the imports and the `CHIPS` array with `CHIP_META`**

Replace lines 1-24 (the two imports plus the whole `CHIPS` array) with:

```tsx
import { Box, Chip, Slider, Stack, Typography } from "@mui/material";
import {
  FILTERABLE_TYPES,
  type FilterableType,
  type VideoAggregates,
} from "../api/types";
import { warnOnce } from "../lib/warn";

// Keyed by FilterableType, so the compiler names any row type missing a chip.
// Display order lives in FILTERABLE_TYPES, not here.
const CHIP_META: Record<
  FilterableType,
  { label: string; count: (agg: VideoAggregates) => string }
> = {
  chat: { label: "Chat", count: (a) => a.chatCount.toLocaleString() },
  superChat: { label: "SuperChat", count: (a) => a.superChatCount.toLocaleString() },
  superSticker: {
    label: "SuperSticker",
    count: (a) => a.superStickerCount.toLocaleString(),
  },
  gift: { label: "Gift", count: (a) => (a.jewelGiftCount ?? 0).toLocaleString() },
  membership: { label: "Member", count: (a) => a.membershipCount.toLocaleString() },
  membershipGift: {
    label: "Gifts Received",
    count: (a) => a.giftCount.toLocaleString(),
  },
  membershipGiftPurchase: {
    label: "Gift Purchases",
    count: (a) =>
      `${a.giftPurchaseCount.toLocaleString()}, ${a.totalGiftAmount.toLocaleString()} gifts`,
  },
  milestone: { label: "Milestone", count: (a) => a.milestoneCount.toLocaleString() },
  poll: { label: "Poll", count: (a) => a.pollCount.toLocaleString() },
  raid: { label: "Raid", count: (a) => a.raidCount.toLocaleString() },
};
```

The `membershipGift` / `membershipGiftPurchase` labels are carried over **verbatim** here on purpose — renaming them is Task 6, so this task stays a pure structural refactor plus one new chip.

- [ ] **Step 2: Rebuild the selection from the tuple in `toggle`**

The function currently ends with `onTypesChange(CHIPS.filter((c) => next.has(c.key)).map((c) => c.key));`. Replace the whole `toggle` with:

```tsx
  const toggle = (key: FilterableType) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onTypesChange(FILTERABLE_TYPES.filter((t) => next.has(t)));
  };
```

- [ ] **Step 3: Render by mapping the tuple**

Replace the `{CHIPS.map((chip) => ( … ))}` block inside the `<Stack>` with:

```tsx
        {FILTERABLE_TYPES.map((key) => {
          const meta = CHIP_META[key];
          return (
            <Chip
              key={key}
              label={`${meta.label} (${meta.count(aggregates)})`}
              color={selected.has(key) ? "primary" : "default"}
              variant={selected.has(key) ? "filled" : "outlined"}
              onClick={() => toggle(key)}
              clickable
            />
          );
        })}
```

Every chip still renders unconditionally — no count-based hiding — so `Gift (0)` shows on pre-r1 archives exactly as `Chat (0)` shows on an empty one. Nothing outside this block changes: the significance `Slider` and its `warnOnce` shape check stay as they are.

- [ ] **Step 4: Prove the record is a real completeness gate**

Temporarily delete the whole `gift:` entry from `CHIP_META`, then:

```bash
npm run typecheck
```

Expected: FAIL, naming the missing key, e.g.:

```
src/components/FilterChips.tsx(...): error TS2741: Property 'gift' is missing in type '{ chat: …; }' but required in type 'Record<FilterableType, …>'.
```

Restore the `gift:` entry before continuing.

- [ ] **Step 5: Run typecheck and lint on the restored file**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/FilterChips.tsx
git commit -m "feat(filter-chips): add the Gift chip via an exhaustive chip record"
```

---

### Task 6: Rename the membership-gift chip labels

**Files:**
- Modify: `src/components/FilterChips.tsx` (the `membershipGift` and `membershipGiftPurchase` entries in `CHIP_META`)
- Test: none — this repo has no test framework

- [ ] **Step 1: Rename both entries**

Replace the two entries written in Task 5 with:

```tsx
  membershipGift: {
    label: "Membership Gifts Received",
    count: (a) => a.giftCount.toLocaleString(),
  },
  membershipGiftPurchase: {
    label: "Membership Gift Purchases",
    count: (a) =>
      `${a.giftPurchaseCount.toLocaleString()}, ${a.totalGiftAmount.toLocaleString()} membership gifts`,
  },
```

Three strings change: both labels, plus the trailing `gifts` → `membership gifts` in the purchase count. The `count` callbacks still read `giftCount` / `giftPurchaseCount` / `totalGiftAmount` — those aggregate fields count **membership** gifts and are unrelated to `jewelGiftCount`.

- [ ] **Step 2: Run typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterChips.tsx
git commit -m "refactor(filter-chips): label membership gifts explicitly"
```

---

### Task 7: Rename the video-card gift stat

**Files:**
- Modify: `src/components/VideoCard.tsx:232`
- Test: none — this repo has no test framework

- [ ] **Step 1: Rename the `StatItem` label**

The third `StatItem` in the card footer currently reads:

```tsx
            <StatItem
              icon={<CardGiftcardIcon sx={statIconSx} />}
              label="Gifts"
              value={video.stats.giftCount.toLocaleString()}
            />
```

Change only the label:

```tsx
            <StatItem
              icon={<CardGiftcardIcon sx={statIconSx} />}
              label="Membership Gifts"
              value={video.stats.giftCount.toLocaleString()}
            />
```

The data source does not change. `stats` gained no Jewels field in archive v2 r1 (only `aggregates.jewelGiftCount` did), so no Jewels stat is added to the card.

- [ ] **Step 2: Run typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoCard.tsx
git commit -m "refactor(video-card): label the gift stat as membership gifts"
```

---

### Task 8: Full verification

**Files:** none modified — this task only runs checks.

- [ ] **Step 1: Run the full automated gate**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all three exit 0. `build` runs `tsr generate && tsc -b && vite build`.

- [ ] **Step 2: Confirm nothing stray got committed**

```bash
git status --porcelain
```

Expected: empty output. If `src/routeTree.gen.ts` appears, do **not** commit it — it is generated and gitignored.

- [ ] **Step 3: Start the dev server against a real data source**

`/data/*` only resolves when `VITE_DATA_PROXY` points at a deployment serving the honeybee `/data` tree:

```bash
cat .env.local 2>/dev/null || cp .env.example .env.local
```

Ensure `VITE_DATA_PROXY` is set in `.env.local`, then:

```bash
npm run dev
```

Leave `npm run dev` running (it prints a URL, by default `http://localhost:5173`). The dev server proxies `/data/*`, so the raw archive files can be inspected through it with `curl` — that is how Step 4 picks its test subjects.

If `VITE_DATA_PROXY` is unset or the proxied deployment is unreachable, **stop here and report that Steps 4–7 could not be run.** Do not mark them done and do not describe UI you did not see.

- [ ] **Step 4: Find the specific videos each later step needs**

Do not go hunting in the UI. Query the proxied archive directly and record the video IDs. `jq` reads JSONL line by line, so these work unmodified. If `jq` is not installed, install it (`brew install jq`) — the fallback of eyeballing raw JSONL is error-prone.

First enumerate candidate video IDs. `fetchJson` prefixes every path with `/data`, so the archive indexes sit at these URLs:

```bash
# Currently live streams:
curl -s "http://localhost:5173/data/realtime.json" | jq -r '.live[].id'

# Every stream that started on a given JST day (pick recent dates —
# gift rows only exist in archives written since v2 r1):
curl -s "http://localhost:5173/data/daily-videos/2026-08-11.json" | jq -r '.videos[].id'
```

Expected: one 11-character YouTube video ID per line. A 404 on a daily file just means that day has no archive — try another date. Feed the IDs into the checks below.

```bash
# A: does this video have gift rows at all, and how many?
curl -s "http://localhost:5173/data/videos/<videoId>.meta.json" \
  | jq '.aggregates.jewelGiftCount'
```

Expected for an r1 archive with gifts: a number `> 0`. `null` means the field is absent — that video is a **pre-r1 archive**, which is exactly what one Step 5 bullet needs. Record one ID of each kind.

```bash
# B: which gift-row shapes does this video actually contain?
curl -s "http://localhost:5173/data/videos/<videoId>.jsonl" \
  | jq -c 'select(.type=="gift") | {amount: (.amount != null), image: (.image != null), giftName: (.giftName != null), assetName: (.assetName != null)}' \
  | sort | uniq -c
```

Expected: a small table such as:

```text
  118 {"amount":true,"image":true,"giftName":true,"assetName":true}
   25 {"amount":false,"image":true,"giftName":true,"assetName":true}
```

`giftName` and `assetName` are tracked separately because the component's name fallback has three levels — `giftName`, else `assetName`, else the literal `"Gift"` — and a row missing both renders differently from a row missing only `giftName`.

This tells you, before opening the browser, exactly which of Step 6's combinations this video can exercise. Repeat B on other videos to cover the combinations the first one lacks — gifts without `image`, and gifts without `giftName`, are rarer than gifts without `amount`.

Write down, for each of the following, either a video ID or "not found in this data source":

1. r1 archive with `jewelGiftCount > 0`
2. pre-r1 archive (`jewelGiftCount` is `null`)
3. gift row with `amount` present **and** `image` present
4. gift row with `amount` absent **and** `image` present
5. gift row with `amount` present **and** `image` absent
6. gift row with `amount` absent **and** `image` absent
7. gift row with `giftName` absent but `assetName` present (non-English locale)
8. gift row with **both** `giftName` and `assetName` absent

Items 3–6 are the four-combination cross-product the spec's §8 verification calls for; items 7–8 cover the second and third levels of the name fallback. A "not found" here is a legitimate outcome — real archives may simply contain no gift that lacks an image, and item 8 in particular may never occur in practice. It is **not** a reason to skip the rest, and it must be carried through to Step 8's report.

- [ ] **Step 5: Verify the chip**

Open the video from item 1 in the browser and confirm:
- A `Gift (N)` chip appears between `SuperSticker` and `Member`.
- `N` equals the `jewelGiftCount` printed by query A.
- The chip is **not** selected on arrival (the default is SuperChat + SuperSticker).

Then open the video from item 2 and confirm the chip reads `Gift (0)` rather than disappearing. If item 2 was "not found", record that this bullet was not exercised and move on.

- [ ] **Step 6: Verify row rendering and every degradation combination**

On the item-1 video, click the `Gift` chip so it is the only one selected, then confirm:
- Only gift rows are listed.
- The timestamp is a YouTube deep link for rows after `actualStart`.

Then, for each of items 3–8 that you found, locate such a row and confirm its rendering:

| Item | Row shape | Expected rendering |
| --- | --- | --- |
| 3 | `amount` + `image` | `10 💎` in monospace, then the image, then the name |
| 4 | no `amount`, `image` | image then name, **no** amount at all — no `N/A`, no `0 💎` |
| 5 | `amount`, no `image` | amount then name, no broken-image icon, no empty gap |
| 6 | no `amount`, no `image` | name alone on the row |
| 7 | no `giftName`, has `assetName` | name falls back to `assetName`, e.g. `finger_heart` |
| 8 | no `giftName`, no `assetName` | name is the literal `Gift` |

Rows for different items may live in different videos — switch videos as needed, the `Gift`-only selection carries over in the URL. For any item recorded as "not found" in Step 4, mark its row here as not exercised — do not claim it rendered correctly.

Finally, scroll several screens of gift rows to exercise the virtualizer. Rows measure taller than the 64px estimate, so a layout bug shows up as jumping or overlap, not as an error in the console.

- [ ] **Step 7: Verify the URL round-trip and the renamed labels**

- With only `Gift` selected, the address bar carries `types=["gift"]`; reload the page and confirm the selection survives (this is what Task 4's zod enum gates — before it, the reload would drop the param).
- Confirm the chips now read `Membership Gifts Received` and `Membership Gift Purchases`, and that the purchase count ends in `… membership gifts`.
- Navigate to the index or a channel page and confirm the video-card footer stat reads `Membership Gifts`.

- [ ] **Step 8: Report**

Report the automated results (Steps 1–2) and then, bullet by bullet, which manual checks were actually exercised and what was observed. Every item Step 4 recorded as "not found in this data source" must appear in the report as **not exercised**, naming the combination that went unverified. An unverified check must never be reported as passing.
