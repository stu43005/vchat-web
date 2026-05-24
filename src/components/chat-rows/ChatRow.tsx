import type { ChatRowChat, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRowBase } from "./ChatRowBase";
import { MEMBERSHIP_GREEN, MODERATOR_BLUE, VERIFIED_GREY } from "./constants";
import { TimestampLink } from "./TimestampLink";

const AUTHOR_BORDER: Record<string, string> = {
  owner: MEMBERSHIP_GREEN,
  moderator: MODERATOR_BLUE,
  verified: VERIFIED_GREY,
};

interface Props {
  row: ChatRowChat;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function ChatRow({ row, no, video, timezone }: Props) {
  const border = AUTHOR_BORDER[row.authorType];
  return (
    <ChatRowBase
      no={no}
      timestamp={<TimestampLink row={row} video={video} timezone={timezone} />}
      photo={row.authorPhoto}
      author={row.authorName ?? ""}
      body={row.message}
      bodySx={border ? { borderLeft: `4px solid ${border}`, pl: 1 } : undefined}
    />
  );
}
