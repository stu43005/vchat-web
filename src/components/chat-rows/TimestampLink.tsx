import type { ChatRow, VideoMeta } from "../../api/types";
import { formatTimestamp, getYouTubeUrl, type TimezonePref } from "../../lib/format";

interface TimestampLinkProps {
  row: ChatRow;
  video: VideoMeta;
  timezone: TimezonePref;
}

export function TimestampLink({ row, video, timezone }: TimestampLinkProps) {
  const display = formatTimestamp(row.timestamp, timezone);
  if (video.actualStart && row.timestamp >= video.actualStart) {
    const t = Math.floor(
      (Date.parse(row.timestamp) - Date.parse(video.actualStart)) / 1000,
    );
    return (
      <a
        href={getYouTubeUrl(video.id, t)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit" }}
      >
        {display}
      </a>
    );
  }
  return <span>{display}</span>;
}
