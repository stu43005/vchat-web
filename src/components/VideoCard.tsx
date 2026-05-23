import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import type {
  ChannelRef,
  VideoSummary,
  VideoSummaryWithoutChannel,
} from "../api/types";
import {
  formatCurrency,
  getYouTubeThumbnail,
  legacyVideoHref,
} from "../lib/format";
import { useTimezonePref } from "../lib/settings";
import { RouterBox, RouterCardActionArea } from "../lib/createMuiLink";
import { StatusText } from "./StatusText";

interface VideoCardProps {
  video: VideoSummary | VideoSummaryWithoutChannel;
  channel: ChannelRef;
  hideChannel?: boolean;
}

export function VideoCard({ video, channel, hideChannel = false }: VideoCardProps) {
  const [timezone] = useTimezonePref();
  const isLegacy = video.archiveVersion < 2;
  const thumbnailSrc = getYouTubeThumbnail(video.id);

  const thumbnailContent = (
    <Box sx={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
      <Box
        component="img"
        src={thumbnailSrc}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {isLegacy && (
        <Chip
          label="Legacy"
          size="small"
          color="default"
          sx={{ position: "absolute", top: 8, left: 8 }}
        />
      )}
    </Box>
  );

  const titleContent = (
    <Typography
      variant="subtitle1"
      sx={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
        wordBreak: "break-word",
        lineHeight: 1.3,
        minHeight: "2.6em",
      }}
    >
      {video.title}
    </Typography>
  );

  const bodyAndFooter = (
    <>
      <CardContent sx={{ pt: 0, pb: 1 }}>
        {!hideChannel && (
          <RouterBox
            to="/channels/$channelId"
            params={{ channelId: channel.id }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              textDecoration: "none",
              color: "inherit",
              mb: 0.5,
            }}
          >
            <Avatar
              src={channel.avatarUrl}
              alt=""
              slotProps={{ img: { loading: "lazy", referrerPolicy: "no-referrer" } }}
              sx={{ width: 24, height: 24 }}
            />
            <Typography variant="body2" noWrap>
              {channel.name}
            </Typography>
          </RouterBox>
        )}
        <Typography variant="caption" color="text.secondary" component="div">
          <StatusText
            status={video.status}
            scheduledStart={video.scheduledStart}
            actualStart={video.actualStart}
            availableAt={video.availableAt}
            timezone={timezone}
          />
        </Typography>
      </CardContent>
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
          fontSize: "0.8125rem",
          color: "text.secondary",
        }}
      >
        <Stack direction="row" spacing={1} divider={<Box>·</Box>}>
          <span>SC: {formatCurrency(video.stats.superChatTotalJpy, "JPY")}</span>
          <span>Members: {video.stats.memberCount.toLocaleString()}</span>
          <span>Gifts: {video.stats.giftCount.toLocaleString()}</span>
        </Stack>
      </Box>
    </>
  );

  return (
    <Card>
      {isLegacy ? (
        <CardActionArea
          component="a"
          href={legacyVideoHref(video, channel)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {thumbnailContent}
          <CardContent sx={{ pb: 1 }}>{titleContent}</CardContent>
        </CardActionArea>
      ) : (
        <RouterCardActionArea
          to="/videos/$videoId"
          params={{ videoId: video.id }}
        >
          {thumbnailContent}
          <CardContent sx={{ pb: 1 }}>{titleContent}</CardContent>
        </RouterCardActionArea>
      )}
      {bodyAndFooter}
    </Card>
  );
}
