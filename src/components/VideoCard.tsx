import { Avatar, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
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
import { RouterAnchor } from "../lib/createMuiLink";
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

  // Overlay-link pattern: a full-card anchor sits behind the content. Any
  // inner link (the channel row) gets a higher z-index and re-enables pointer
  // events so it captures its own clicks. Display elements above the overlay
  // need pointer-events: none so clicks fall through to the card link.
  const overlayLinkSx = {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    cursor: "pointer",
    textDecoration: "none",
    color: "inherit",
    "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
  } as const;

  const cardLink = isLegacy ? (
    <Box
      component="a"
      href={legacyVideoHref(video, channel)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={video.title}
      sx={overlayLinkSx}
    />
  ) : (
    <RouterAnchor
      to="/videos/$videoId"
      params={{ videoId: video.id }}
      aria-label={video.title}
      sx={overlayLinkSx}
    />
  );

  return (
    <Card sx={{ position: "relative" }}>
      {cardLink}
      <Box
        sx={{
          // No position/z-index here: a stacking context on this wrapper
          // would cap the channel link's z-index below the overlay's, so
          // the overlay would intercept all clicks. Leaving it static lets
          // the channel link (z:2) sit above the overlay (z:1).
          pointerEvents: "none",
        }}
      >
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
        <CardContent sx={{ pb: 1 }}>
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
        </CardContent>
        <CardContent sx={{ pt: 0, pb: 1 }}>
          {!hideChannel && (
            <RouterAnchor
              to="/channels/$channelId"
              params={{ channelId: channel.id }}
              sx={{
                position: "relative",
                zIndex: 2,
                pointerEvents: "auto",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                textDecoration: "none",
                color: "inherit",
                mb: 0.5,
                "&:hover .channel-name": { textDecoration: "underline" },
              }}
            >
              <Avatar
                src={channel.avatarUrl}
                alt=""
                slotProps={{ img: { loading: "lazy", referrerPolicy: "no-referrer" } }}
                sx={{ width: 24, height: 24 }}
              />
              <Typography className="channel-name" variant="body2" noWrap>
                {channel.name}
              </Typography>
            </RouterAnchor>
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
      </Box>
    </Card>
  );
}
