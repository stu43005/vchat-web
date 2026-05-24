import type { ChatRowRaid, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowRaid;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function RaidRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.sourcePhoto ?? null}
      author="Raid (incoming)"
      body={`${row.sourceName} and their viewers just joined. Say hello!`}
    />
  );
}
