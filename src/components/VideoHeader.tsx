import { Avatar, Box, Stack, Typography } from "@mui/material";
import type { VideoMeta } from "../api/types";
import { getYouTubeThumbnail, getYouTubeUrl, type TimezonePref } from "../lib/format";
import { RouterChip } from "../lib/createMuiLink";
import { StatusText } from "./StatusText";

interface VideoHeaderProps {
  video: VideoMeta;
  timezone: TimezonePref;
}

export function VideoHeader({ video, timezone }: VideoHeaderProps) {
  const ytUrl = getYouTubeUrl(video.id);
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
      <Box
        component="a"
        href={ytUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ flexShrink: 0, display: "block", width: 240, aspectRatio: "16/9" }}
      >
        <Box
          component="img"
          src={getYouTubeThumbnail(video.id)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </Box>
      <Stack spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="h5"
          component="a"
          href={ytUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "inherit", textDecoration: "none" }}
        >
          {video.title}
        </Typography>
        <Box>
          <RouterChip
            to="/channels/$channelId"
            params={{ channelId: video.channel.id }}
            clickable
            avatar={
              <Avatar
                src={video.channel.avatarUrl}
                slotProps={{ img: { loading: "lazy", referrerPolicy: "no-referrer" } }}
              />
            }
            label={video.channel.name}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          <StatusText
            status={video.status}
            scheduledStart={video.scheduledStart}
            actualStart={video.actualStart}
            availableAt={video.availableAt}
            timezone={timezone}
          />
        </Typography>
      </Stack>
    </Stack>
  );
}
