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
