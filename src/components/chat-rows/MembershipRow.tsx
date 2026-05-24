import { Box } from "@mui/material";
import type { ChatRowMembership, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowMembership;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function MembershipRow({ row, no, video, timezone }: Props) {
  const label = row.level ?? row.membership ?? "N/A";
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ borderLeft: "4px solid #00984f", pl: 1 }}>
          Joined as a member ({label})
        </Box>
      }
    />
  );
}
