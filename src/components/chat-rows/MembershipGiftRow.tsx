import { Box } from "@mui/material";
import type { ChatRowMembershipGift, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowMembershipGift;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function MembershipGiftRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ borderLeft: "4px solid #00984f", pl: 1 }}>
          Received a membership gift from {row.senderName ?? "N/A"}
        </Box>
      }
    />
  );
}
