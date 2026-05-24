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
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
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
