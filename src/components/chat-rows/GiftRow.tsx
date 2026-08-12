import { Box, Typography } from "@mui/material";
import type { ChatRowGift, VideoMeta } from "../../api/types";
import { formatJewels, type TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowGift;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function GiftRow({ row, no, video, timezone }: Props) {
  // parseJSONL validates only the `type` discriminator and casts the rest, so
  // these declared-optional fields are contract claims, not checked facts.
  // Guard at the render boundary: `amount.toLocaleString()` on a non-number
  // throws, and inside the virtualized list that takes down the whole chat,
  // not one row. A non-string `image` would not throw but would fire a bogus
  // request for a coerced src such as "[object Object]".
  const amount =
    typeof row.amount === "number" && Number.isFinite(row.amount)
      ? row.amount
      : undefined;
  const name =
    typeof row.giftName === "string"
      ? row.giftName
      : typeof row.assetName === "string"
        ? row.assetName
        : "Gift";
  const image = typeof row.image === "string" ? row.image : undefined;

  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {amount !== undefined ? (
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              {formatJewels(amount)}
            </Typography>
          ) : null}
          {image !== undefined ? (
            <Box
              component="img"
              src={image}
              alt={name}
              title={name}
              loading="lazy"
              referrerPolicy="no-referrer"
              sx={{ maxHeight: 48 }}
            />
          ) : null}
          <Typography variant="body2">{name}</Typography>
        </Box>
      }
    />
  );
}
