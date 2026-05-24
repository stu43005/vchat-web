import { Box, Typography } from "@mui/material";
import type { ChatRowMilestone, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowMilestone;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function MilestoneRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={
        <Box sx={{ borderLeft: "4px solid #00984f", pl: 1 }}>
          {row.message !== null ? (
            row.message
          ) : (
            <Typography component="span" sx={{ fontStyle: "italic", color: "primary.main" }}>
              (wordless milestone)
            </Typography>
          )}
        </Box>
      }
    />
  );
}
