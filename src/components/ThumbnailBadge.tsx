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
