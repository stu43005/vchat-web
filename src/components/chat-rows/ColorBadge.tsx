import { Box } from "@mui/material";

export function ColorBadge({ color }: { color?: string }) {
  return (
    <Box
      sx={{
        width: 8,
        minHeight: 24,
        bgcolor: color ?? "transparent",
        borderRadius: 0.5,
        flexShrink: 0,
      }}
    />
  );
}
