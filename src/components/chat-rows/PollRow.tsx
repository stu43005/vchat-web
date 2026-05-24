import { Box } from "@mui/material";
import type { ChatRowPoll, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowPoll;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function PollRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={null}
      author="Poll"
      body={
        <Box>
          {row.voteCount !== undefined && <div>{row.voteCount} votes</div>}
          <div>{row.question ?? "(empty question)"}</div>
          {row.choices.map((choice, i) => {
            const pct =
              choice.voteRatio !== undefined
                ? ` (${Math.floor(choice.voteRatio * 1000) / 10}%)`
                : "";
            return <div key={i}>{`- ${choice.text}${pct}`}</div>;
          })}
        </Box>
      }
    />
  );
}
