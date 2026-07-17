import { createFileRoute } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";
import { useRealtimeQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  useDocumentTitle("VChat");
  const query = useRealtimeQuery();

  if (query.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" sx={{ aspectRatio: "16/9" }} />
              <Skeleton width="80%" />
              <Skeleton width="60%" />
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
          <Alert severity="warning">No realtime data found.</Alert>
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
          Failed to load live streams.
        </Alert>
      </Container>
    );
  }

  const list = query.data.live;

  return (
    <Container sx={{ py: 2 }}>
      {list.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Typography color="text.secondary">No live streams right now</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {list.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={video.channel} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
