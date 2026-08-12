export interface AuthorFields {
  id: string;
  timestamp: string;
  authorName?: string;
  authorPhoto?: string;
  authorChannelId: string;
  authorType: "owner" | "moderator" | "member" | "verified" | "other";
  membership?: string;
  isVerified: boolean;
  isOwner: boolean;
  isModerator: boolean;
}

export interface ChatRowChat extends AuthorFields {
  type: "chat";
  message: string;
}

export interface ChatRowSuperChat extends AuthorFields {
  type: "superChat";
  message: string | null;
  amount: number;
  currency: string;
  jpyAmount: number;
  significance?: number;
  color?: string;
}

export interface ChatRowSuperSticker extends AuthorFields {
  type: "superSticker";
  text?: string;
  image: string;
  amount: number;
  currency: string;
  jpyAmount: number;
  significance?: number;
  color?: string;
}

export interface ChatRowGift extends AuthorFields {
  type: "gift";
  giftName?: string; // display name; absent outside the English locale
  assetName?: string; // gift image file name, e.g. "finger_heart"
  image?: string; // gift image URL
  amount?: number; // Jewels for this ONE gift; absent when the price is unknown
  currency: string; // always "JEWEL"
}

export interface ChatRowMembership extends AuthorFields {
  type: "membership";
  level?: string;
  since?: string;
}

export interface ChatRowMembershipGift extends AuthorFields {
  type: "membershipGift";
  senderName?: string;
}

export interface ChatRowMembershipGiftPurchase extends AuthorFields {
  type: "membershipGiftPurchase";
  amount: number;
}

export interface ChatRowMilestone extends AuthorFields {
  type: "milestone";
  message: string | null;
  level?: string;
  duration?: number;
  since?: string;
}

export interface ChatRowPoll {
  type: "poll";
  id: string;
  timestamp: string;
  createdAt?: string;
  question?: string;
  choices: Array<{ text: string; voteRatio?: number }>;
  voteCount?: number;
}

export interface ChatRowRaid {
  type: "raid";
  id?: string;
  timestamp: string;
  sourceVideoId?: string;
  sourceChannelId?: string;
  sourceName: string;
  sourcePhoto?: string;
}

export interface ChatRowRaidOutgoing {
  type: "raidOutgoing";
  id?: string;
  timestamp: string;
  originVideoId: string;
  originChannelId?: string;
  originName?: string;
  originPhoto?: string;
}

export type ChatRow =
  | ChatRowChat
  | ChatRowSuperChat
  | ChatRowSuperSticker
  | ChatRowGift
  | ChatRowMembership
  | ChatRowMembershipGift
  | ChatRowMembershipGiftPurchase
  | ChatRowMilestone
  | ChatRowPoll
  | ChatRowRaid
  | ChatRowRaidOutgoing;

export type FilterableType = Exclude<ChatRow["type"], "raidOutgoing">;

export interface ChannelRef {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface VideoStats {
  superChatTotalJpy: number;
  memberCount: number;
  giftCount: number;
}

export type VideoStatus = "new" | "upcoming" | "live" | "past" | "missing";

export interface VideoSummary {
  id: string;
  title: string;
  channel: ChannelRef;
  status: VideoStatus;
  duration: number;
  availableAt: string;
  archiveVersion: number;
  stats: VideoStats;
  scheduledStart?: string;
  actualStart?: string;
  actualEnd?: string;
  publishedAt?: string;
  viewers?: number; // live concurrent viewers; 0 after finish
  maxViewers?: number; // peak concurrent viewers; persists after finish
  likes?: number; // like count; persists after finish
  premiere?: boolean; // true for YouTube premieres
}

export type VideoSummaryWithoutChannel = Omit<VideoSummary, "channel">;

export interface RealtimeIndex {
  snapshotAt: string;
  live: VideoSummary[];
}

export interface UpcomingIndex {
  snapshotAt: string;
  upcoming: VideoSummary[];
  recentlyStarted: VideoSummary[];
}

export interface DailyVideos {
  date: string; // "YYYY-MM-DD" (JST) — the day this file lists
  snapshotAt: string;
  videos: VideoSummary[];
}

export interface ChannelData extends ChannelRef {
  videos: VideoSummaryWithoutChannel[];
}

export interface CurrencyAgg {
  currency: string;
  amount: number;
  jpyAmount: number;
}

export interface VideoAggregates {
  chatCount: number;
  superChatCount: number;
  superStickerCount: number;
  membershipCount: number;
  giftCount: number; // membership gifts, NOT Jewels gifts
  giftPurchaseCount: number;
  totalGiftAmount: number;
  jewelGiftCount?: number; // gift rows; since archive v2 r1
  milestoneCount: number;
  pollCount: number;
  raidCount: number;
  currencyTable: CurrencyAgg[];
  jpyTotal: number;
}

export interface VideoMeta extends VideoSummary {
  aggregates: VideoAggregates;
}
