import type { ChatRow, VideoMeta } from "../../api/types";
import type { TimezonePref } from "../../lib/format";
import { ChatRow as ChatRowComponent } from "./ChatRow";
import { SuperChatRow } from "./SuperChatRow";
import { SuperStickerRow } from "./SuperStickerRow";
import { MembershipRow } from "./MembershipRow";
import { MembershipGiftRow } from "./MembershipGiftRow";
import { MembershipGiftPurchaseRow } from "./MembershipGiftPurchaseRow";
import { MilestoneRow } from "./MilestoneRow";
import { PollRow } from "./PollRow";
import { RaidRow } from "./RaidRow";
import { RaidOutgoingRow } from "./RaidOutgoingRow";

interface Props {
  row: ChatRow;
  no: number;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function RowDispatcher({ row, no, video, timezone }: Props) {
  switch (row.type) {
    case "chat":
      return <ChatRowComponent row={row} no={no} video={video} timezone={timezone} />;
    case "superChat":
      return <SuperChatRow row={row} no={no} video={video} timezone={timezone} />;
    case "superSticker":
      return <SuperStickerRow row={row} no={no} video={video} timezone={timezone} />;
    case "membership":
      return <MembershipRow row={row} no={no} video={video} timezone={timezone} />;
    case "membershipGift":
      return <MembershipGiftRow row={row} no={no} video={video} timezone={timezone} />;
    case "membershipGiftPurchase":
      return <MembershipGiftPurchaseRow row={row} no={no} video={video} timezone={timezone} />;
    case "milestone":
      return <MilestoneRow row={row} no={no} video={video} timezone={timezone} />;
    case "poll":
      return <PollRow row={row} no={no} video={video} timezone={timezone} />;
    case "raid":
      return <RaidRow row={row} no={no} video={video} timezone={timezone} />;
    case "raidOutgoing":
      return <RaidOutgoingRow row={row} no={no} video={video} timezone={timezone} />;
    default: {
      const _exhaustive: never = row;
      void _exhaustive;
      return null;
    }
  }
}
