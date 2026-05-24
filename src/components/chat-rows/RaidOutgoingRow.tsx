import type { ChatRowRaidOutgoing, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { TimestampLink } from "./TimestampLink";

interface Props {
  row: ChatRowRaidOutgoing;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function RaidOutgoingRow({ row, no, video, timezone }: Props) {
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.originPhoto ?? null}
      author="Raid (outgoing)"
      body={`Sending you to ${row.originName ?? "unknown channel"}`}
    />
  );
}
