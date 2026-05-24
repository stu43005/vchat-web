import { createFileRoute } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Container,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";
import { useChannelQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { ChannelHeader } from "../components/ChannelHeader";
import { VideoCard } from "../components/VideoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export const Route = createFileRoute("/channels/$channelId")({
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = Route.useParams();
  const query = useChannelQuery(channelId);
  useDocumentTitle(query.data ? `${query.data.name} — VChat` : "VChat");

  if (query.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <ChannelHeader loading />
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" sx={{ aspectRatio: "16/9" }} />
              <Skeleton width="80%" />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (query.isError) {
    if (query.error instanceof NotFoundError) {
      return (
        <Container sx={{ py: 2 }}>
          <Alert severity="warning">Channel not found.</Alert>
        </Container>
      );
    }
    return (
      <Container sx={{ py: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => query.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Failed to load channel.
        </Alert>
      </Container>
    );
  }

  const data = query.data;
  return (
    <Container sx={{ py: 2 }}>
      <ChannelHeader channel={data} />
      {data.videos.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          No archives for this channel.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {data.videos.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={data} hideChannel />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
