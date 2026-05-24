import { Box, Typography } from "@mui/material";
import type { ChatRowSuperSticker, VideoMeta } from "../../api/types";
import { formatSuperAmount, type TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { ColorBadge } from "./ColorBadge";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowSuperSticker;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function SuperStickerRow({ row, no, video, timezone }: Props) {
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
          <Box
            component="img"
            src={row.image}
            alt={row.text ?? "sticker"}
            title={row.text ?? ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            sx={{ maxHeight: 48 }}
          />
        </Box>
      }
    />
  );
}
