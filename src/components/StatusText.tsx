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
