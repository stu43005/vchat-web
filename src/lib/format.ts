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

// YouTube Gifts are priced in Jewels, whose `currency` code is the literal
// "JEWEL". That is not a 3-letter ISO 4217 code, so formatCurrency (which
// calls Intl with style: "currency") throws RangeError on it. Format the
// bare number and append the gem glyph instead.
export function formatJewels(amount: number): string {
  return `${amount.toLocaleString("en-US")} 💎`;
}

// JST calendar date as "YYYY-MM-DD" from an ISO instant. (ymdInTokyo above
// returns "YYYYMMDD" without dashes and is kept for the legacy redirect path.)
export function ymdDashInTokyo(iso: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

// Current JST calendar date as "YYYY-MM-DD".
export function todayYmdInTokyo(): string {
  return ymdDashInTokyo(new Date().toISOString());
}

// Pure calendar-date arithmetic on a "YYYY-MM-DD" string. Constructed in UTC
// so the result is free of the host timezone and DST — the string is treated
// as a bare calendar date, not an instant.
export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// True only for a real calendar date in "YYYY-MM-DD" shape. Rejects impossible
// dates such as "2026-99-99", "0000-00-00", "2026-02-30" via a UTC round-trip.
export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// YouTube-style clock format from a whole-second count. >= 3600s -> "H:MM:SS"
// (hours unpadded), else "M:SS" (minutes unpadded). Negative / non-finite -> "0:00".
export function formatDuration(seconds: number): string {
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h >= 1 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

