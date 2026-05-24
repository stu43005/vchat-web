import { currencyMap } from "./currency";

export type TimezonePref = "local" | "Asia/Tokyo" | "UTC";

export function formatCurrency(
  amount: number,
  currency: string,
  style: "currency" | "decimal" = "currency",
): string {
  const digits = currencyMap[currency]?.decimal_digits ?? 2;
  return amount.toLocaleString("en-US", {
    style,
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const timestampFormatters = new Map<TimezonePref, Intl.DateTimeFormat>();

function getTimestampFormatter(timezone: TimezonePref): Intl.DateTimeFormat {
  let fmt = timestampFormatters.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: timezone === "local" ? undefined : timezone,
    });
    timestampFormatters.set(timezone, fmt);
  }
  return fmt;
}

export function formatTimestamp(iso: string, timezone: TimezonePref): string {
  const parts = Object.fromEntries(
    getTimestampFormatter(timezone)
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function getYouTubeUrl(videoId: string, t?: number): string {
  return t !== undefined
    ? `https://youtu.be/${videoId}?t=${t}`
    : `https://youtu.be/${videoId}`;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function ymdInTokyo(iso: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}`;
}

export function formatSuperAmount(row: {
  currency: string;
  amount: number;
  jpyAmount: number;
}): string {
  return row.currency === "JPY"
    ? formatCurrency(row.jpyAmount, "JPY")
    : `${formatCurrency(row.amount, row.currency)} (${formatCurrency(row.jpyAmount, "JPY")})`;
}

export function legacyVideoHref(
  video: { id: string; availableAt: string },
  channel: { id: string },
): string {
  return `/${channel.id}/${ymdInTokyo(video.availableAt)}_${video.id}.html`;
}
