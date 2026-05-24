import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { z } from "zod";
import { useIndexQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const indexSearchSchema = z.object({
  tab: z.enum(["live", "past"]).default("live"),
});

export const Route = createFileRoute("/")({
  validateSearch: indexSearchSchema,
  component: IndexPage,
});

function IndexPage() {
  useDocumentTitle("VChat");
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const query = useIndexQuery();

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
          <Alert severity="warning">No archive index found.</Alert>
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
          Failed to load archive index.
        </Alert>
      </Container>
    );
  }

  const data = query.data;
  const list = tab === "live" ? data.live : data.past;

  return (
    <Container sx={{ py: 2 }}>
      <Tabs
        value={tab}
        onChange={(_, value: "live" | "past") =>
          navigate({ search: { tab: value }, replace: true })
        }
        sx={{ mb: 2 }}
      >
        <Tab value="live" label={`Live / Upcoming (${data.live.length})`} />
        <Tab value="past" label={`Past (${data.past.length})`} />
      </Tabs>
      {list.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Typography color="text.secondary">
            {tab === "live" ? "No live streams" : "No past archives"}
          </Typography>
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
