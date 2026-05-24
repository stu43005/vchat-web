import { Avatar, Box, IconButton, Skeleton, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { ChannelRef } from "../api/types";

interface ChannelHeaderProps {
  channel?: ChannelRef;
  loading?: boolean;
}

export function ChannelHeader({ channel, loading }: ChannelHeaderProps) {
  if (loading || !channel) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Skeleton variant="circular" width={64} height={64} />
        <Skeleton width={240} height={36} />
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
      <Avatar
        src={channel.avatarUrl}
        alt=""
        slotProps={{ img: { loading: "lazy", referrerPolicy: "no-referrer" } }}
        sx={{ width: 64, height: 64 }}
      />
      <Typography variant="h4" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
        {channel.name}
      </Typography>
      <IconButton
        component="a"
        href={`https://www.youtube.com/channel/${channel.id}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="open channel on YouTube"
      >
        <OpenInNewIcon />
      </IconButton>
    </Box>
  );
}
