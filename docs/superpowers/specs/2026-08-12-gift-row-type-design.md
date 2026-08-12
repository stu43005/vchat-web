# Gift row type (YouTube Gifts / Jewels)

**Date:** 2026-08-12
**Status:** Design (approved, pending spec review)

## 1. Summary

honeybee's archive contract gained a `gift` row type — YouTube Gifts,
bought with Jewels — in `video-chats` v2 r1, plus a companion
`aggregates.jewelGiftCount` in `video-meta` v2 r1. The SPA currently
drops every `gift` row on the floor: `parseJSONL`'s `rowTypeSchema`
enum does not list `"gift"`, so each such line is discarded with a
`warnOnce("invalid row type")`.

This is a **reader-only** change. Both fields are already emitted by
honeybee as additive revisions; no honeybee PR and no writer change is
required. The SPA starts reading what the writer already produces.

The change adds the row type end to end — parse, type, render, filter —
and renames the existing membership-gift labels so the two distinct
notions of "gift" are no longer ambiguous in the UI.

## 2. Goals

- Parse and render `gift` rows in the video page's chat list.
- Add a `Gift` filter chip driven by `aggregates.jewelGiftCount`.
- Rename every existing UI label that shows a **membership** gift count
  so it reads "Membership Gift…", disambiguating it from the new
  Jewels gift.
- Keep the change confined to the existing one-component-per-row-type
  pattern.

## 3. Non-goals / Accepted limitations

- **No Jewels total anywhere.** `stats` gained no Jewels field in r1,
  and `aggregates` deliberately carries a *count* rather than a total
  (a gift row's `amount` is absent until the price table learns that
  asset, and the archive is written once and never revised, so a total
  would freeze whatever undercount held at archive time). The SPA
  therefore shows no Jewels sum on video cards, in the header, or in
  the currency table.
- **No per-field validation of `gift` rows.** `parseJSONL` validates
  only the `type` discriminator and casts the rest; `gift` gets the
  same treatment as every other row type. Introducing field-level
  validation for one row type would break that uniformity.
- **`gift` is not added to `DEFAULT_TYPES`.** A single stream can carry
  hundreds of gift rows (the contract doc's own example shows 143),
  which would swamp the SuperChat rows the default view exists to
  surface.
- **No consolidation of the filterable-type list.** The set of
  filterable row types is currently spelled out in three places
  (`FilterableType` in `types.ts`, `filterableTypeEnum` in the video
  route, `CHIPS` in `FilterChips.tsx`). Collapsing them to one source
  is a worthwhile but separate change; doing it here would enlarge the
  review surface of an otherwise additive change.
- **No test framework.** The project has none (no `test` script, no
  vitest/jest). This change does not introduce one; see §8.

## 4. Upstream contract (already shipped)

From `video-chats.md`, v2 r1:

```ts
interface GiftRow extends AuthorRowBase {
  type: "gift";
  giftName?: string; // display name; absent outside the English locale
  assetName?: string; // gift image file name, e.g. "finger_heart"
  image?: string; // gift image URL
  amount?: number; // Jewels for this one gift; absent when price unknown
  currency: string; // always "JEWEL"
}
```

Contract facts this design leans on:

- One gift is one row. `amount` is a **unit price**, never a wave
  total, even when YouTube rewrote the source message as a
  `comboed xN` summary.
- `authorChannelId` is an empty string unless the gift cost ≥ 100
  Jewels.
- `authorType` is always `"other"`; `isVerified` / `isOwner` /
  `isModerator` are always `false`. A gift row carries no badge
  information.
- `amount` is absent when the price was unknown at archive time.

From `video-meta.md`, v2 r1:

```ts
interface VideoAggregates {
  // ...every r0 field, unchanged
  jewelGiftCount: number; // since r1
}
```

`jewelGiftCount` counts `gift` rows in the companion `.jsonl`. It is
distinct from `giftCount` / `giftPurchaseCount`, which count membership
gifts.

## 5. Data layer

### 5.1 `src/api/types.ts`

Add the interface after `ChatRowSuperSticker`, mirroring the union
order in the upstream contract:

```ts
export interface ChatRowGift extends AuthorFields {
  type: "gift";
  giftName?: string;
  assetName?: string;
  image?: string;
  amount?: number;
  currency: string;
}
```

Add `ChatRowGift` to the `ChatRow` union in the same position.
`FilterableType` is derived (`Exclude<ChatRow["type"], "raidOutgoing">`)
and picks up `"gift"` with no edit.

Add to `VideoAggregates`:

```ts
jewelGiftCount?: number; // since archive v2 r1; membership gifts are giftCount
```

**Why optional:** meta files written before r1 lack the field. Their
companion `.jsonl` cannot contain `gift` rows either — the row type and
the aggregate landed in the same revision — so treating an absent
`jewelGiftCount` as `0` is exact, not a guess. Annotate the existing
`giftCount` with "membership gifts, not Jewels gifts" to match the
upstream doc.

### 5.2 `src/lib/jsonl.ts`

Add `"gift"` to `rowTypeSchema`'s enum, positioned to match the type
union. Nothing else changes: the parser validates only `type` and casts
the rest, and `gift` follows that rule.

## 6. Rendering

### 6.1 `src/lib/format.ts`

```ts
export function formatJewels(amount: number): string {
  return `${amount.toLocaleString("en-US")} 💎`;
}
```

`formatCurrency` cannot be reused. It calls `toLocaleString` with
`style: "currency"`, and `"JEWEL"` is not a three-letter ISO 4217 code,
so `Intl` throws `RangeError` — which would take down the whole row
render, not just the amount.

`GiftRow` does not read `row.currency`. The contract fixes it at
`"JEWEL"`, so there is no branch to take on it.

### 6.2 `src/components/chat-rows/GiftRow.tsx`

New component, laid out like `SuperStickerRow`: a flex row of amount,
image, name inside `ChatRowBase`'s body cell.

```
amount (monospace)   image (maxHeight 48)   name
10 💎                [🖼]                   Heart
                     [🖼]                   rose      ← amount absent
```

- **amount** — rendered via `formatJewels(row.amount)` only when
  `row.amount !== undefined`. When absent, the slot is empty. No
  `"N/A"` placeholder: it would be indistinguishable at a glance from
  a real `0`.
- **image** — `<Box component="img">` with `loading="lazy"` and
  `referrerPolicy="no-referrer"` (the assets are gstatic URLs; this
  matches the project's external-image convention). Omitted entirely
  when `row.image` is absent.
- **name** — `row.giftName ?? row.assetName ?? "Gift"`. The same string
  is the image's `alt` and `title`.

No `ColorBadge` (a gift row has no `color`) and no left accent border
(`authorType` is always `"other"`, so there is no badge state to
express).

Author photo and name come from `ChatRowBase`'s existing slots.
Timestamp uses `TimestampLink` unchanged — a gift row has a
`timestamp`, and the deep-link offset logic is row-type agnostic.

`authorChannelId` needs no handling: the SPA never renders it (the
author cell shows `authorName` only, with no channel link), so the
contract's empty-string case is inert here.

### 6.3 `src/components/chat-rows/RowDispatcher.tsx`

Add `case "gift"` returning `<GiftRow …/>`. Until it is added, the
`never` exhaustiveness branch fails the build — the intended safety
net.

## 7. Filtering and labels

### 7.1 `src/routes/videos.$videoId.tsx`

Add `"gift"` to `filterableTypeEnum`. This zod enum validates the
`types` search param, so without it `?types=["gift"]` would be rejected
and the filter would be unreachable by URL.

`DEFAULT_TYPES` stays `["superChat", "superSticker"]` (§3).

### 7.2 `src/components/FilterChips.tsx`

Insert one entry into `CHIPS`, after `superSticker` and before
`membership`, grouping the paid-tip types together:

```ts
{ key: "gift", label: "Gift", count: (a) => (a.jewelGiftCount ?? 0).toLocaleString() },
```

`CHIPS` order also determines the order `toggle()` writes back into the
URL's `types` array. Inserting mid-list changes that serialization for
existing bookmarks, but both `ChatList` and `FilterChips` compare via
`Set`, so order is cosmetic and no bookmark breaks.

`ChatList` needs no change: the significance range is applied only in
the `superChat` / `superSticker` branch, and `gift` has no
`significance`.

### 7.3 Label renames

Three surfaces currently say "gift" while meaning **membership** gift.
Rename them so the new type is unambiguous:

| Location | Current | New |
| --- | --- | --- |
| `FilterChips` → `membershipGift` label | `Gifts Received` | `Membership Gifts Received` |
| `FilterChips` → `membershipGiftPurchase` label | `Gift Purchases` | `Membership Gift Purchases` |
| `FilterChips` → `membershipGiftPurchase` count | `…, N gifts` | `…, N membership gifts` |
| `VideoCard` → `StatItem` | `Gifts` | `Membership Gifts` |

`VideoCard` reads `video.stats.giftCount`, and `stats` gained no Jewels
field in r1, so the card's label changes but its data source does not.
No Jewels stat is added to the card.

## 8. Edge cases and verification

Edge cases:

- **Pre-r1 archives** (v1 legacy and v2 r0) — `jewelGiftCount` is
  absent, the chip reads `Gift (0)`, matching how every other chip
  renders a zero count on an empty archive.
- **`amount: 0`** — renders `0 💎`, visibly distinct from an absent
  amount (which renders nothing).
- **All optional fields absent** — a row with no `giftName`,
  `assetName`, `image`, or `amount` still renders: timestamp, author,
  and the literal name `Gift`.
- **Unknown extra fields** — ignored, per the contract's
  forward-compatibility rule and the parser's existing cast.

Verification:

- `npm run typecheck` and `npm run lint` must pass. The `never` branch
  in `RowDispatcher` makes typecheck a real gate on completeness here.
- Manual check against a dev server pointed at a data source with gift
  rows: confirm the four degradation combinations (amount present or
  absent × image present or absent), the chip count matching
  `jewelGiftCount`, and that filtering by `Gift` alone shows only gift
  rows.
- No automated tests are added; the project has no test framework and
  introducing one is out of scope (§3).
