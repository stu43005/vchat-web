import { Box, Typography } from "@mui/material";
import type { ChatRowSuperChat, VideoMeta } from "../../api/types";
import { formatSuperAmount, type TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { ColorBadge } from "./ColorBadge";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowSuperChat;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function SuperChatRow({ row, no, video, timezone }: Props) {
  const amount = formatSuperAmount(row);

  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ColorBadge color={row.color ?? undefined} />
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
