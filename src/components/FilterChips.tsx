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
    onTypesChange(FILTERABLE_TYPES.filter((t) => next.has(t)));
  };

  return (
    <Box sx={{ my: 2 }}>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
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
      </Stack>
      <Box sx={{ mt: 3, maxWidth: 480 }}>
        <Typography variant="caption" color="text.secondary">
          Significance range (SuperChat / Sticker)
        </Typography>
        <Slider
          value={sigRange}
          min={1}
          max={7}
          step={1}
          marks
          valueLabelDisplay="auto"
          onChange={(_, raw) => {
            // Range mode (value is a tuple) always yields a 2-element array.
            // If MUI ever changes that contract, warn rather than silently
            // dropping the change.
            if (!Array.isArray(raw) || raw.length !== 2) {
              warnOnce(
                "FilterChips slider shape",
                `expected [number, number], got ${JSON.stringify(raw)}`,
              );
              return;
            }
            const [a, b] = raw;
            onSigRangeChange(a <= b ? [a, b] : [b, a]);
          }}
        />
      </Box>
    </Box>
  );
}
