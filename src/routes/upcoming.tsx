import { createFileRoute } from "@tanstack/react-router";
import { Alert, Box, Button, Container, Grid, Typography } from "@mui/material";
import { useUpcomingQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { VideoCardSkeleton } from "../components/VideoCardSkeleton";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { VideoSummary } from "../api/types";

export const Route = createFileRoute("/upcoming")({
  component: UpcomingPage,
});

function Section({
  title,
  videos,
  emptyNote,
}: {
  title: string;
  videos: VideoSummary[];
  emptyNote: string;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {videos.length === 0 ? (
        <Typography color="text.secondary">{emptyNote}</Typography>
      ) : (
        <Grid container spacing={2}>
          {videos.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={video.channel} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

function UpcomingPage() {
  useDocumentTitle("Upcoming — VChat");
  const query = useUpcomingQuery();

  if (query.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCardSkeleton />
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
          <Alert severity="warning">No upcoming data found.</Alert>
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
          Failed to load upcoming streams.
        </Alert>
      </Container>
    );
  }

  const { recentlyStarted, upcoming } = query.data;

  return (
    <Container sx={{ py: 2 }}>
      <Section
        title="Recently Started"
        videos={recentlyStarted}
        emptyNote="No recently started streams"
      />
      <Section
        title="Scheduled"
        videos={upcoming}
        emptyNote="No scheduled streams"
      />
    </Container>
  );
}
