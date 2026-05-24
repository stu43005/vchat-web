import { Box, Chip, Slider, Stack, Typography } from "@mui/material";
import type { FilterableType, VideoAggregates } from "../api/types";
import { warnOnce } from "../lib/warn";

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
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
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
