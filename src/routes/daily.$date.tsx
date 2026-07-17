import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { z } from "zod";
import { useDailyVideosQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { VideoCardSkeleton } from "../components/VideoCardSkeleton";
import { NotFound } from "../components/NotFound";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { addDaysYmd, isValidYmd, todayYmdInTokyo } from "../lib/format";
import type { VideoSummary } from "../api/types";

type SortKey = "availableAt" | "maxViewers" | "likes";

const dailySearchSchema = z.object({
  sort: z.enum(["availableAt", "maxViewers", "likes"]).default("availableAt"),
});

export const Route = createFileRoute("/daily/$date")({
  validateSearch: dailySearchSchema,
  component: DailyPage,
});

function byIdAsc(a: VideoSummary, b: VideoSummary): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Returns a sorted shallow copy; missing metric values sort last; ties by id.
function sortVideos(videos: VideoSummary[], sort: SortKey): VideoSummary[] {
  const copy = [...videos];
  if (sort === "availableAt") {
    copy.sort((a, b) =>
      a.availableAt < b.availableAt
        ? 1
        : a.availableAt > b.availableAt
          ? -1
          : byIdAsc(a, b),
    );
    return copy;
  }
  copy.sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    const am = av === undefined;
    const bm = bv === undefined;
    if (am && bm) return byIdAsc(a, b);
    if (am) return 1;
    if (bm) return -1;
    if (bv !== av) return bv - av;
    return byIdAsc(a, b);
  });
  return copy;
}

function DailyPage() {
  const { date } = Route.useParams();
  const { sort } = Route.useSearch();
  const navigate = useNavigate();

  const isToday = date === "today";
  const valid = isToday || (isValidYmd(date) && date <= todayYmdInTokyo());
  const query = useDailyVideosQuery(valid ? date : undefined);

  const resolvedDate = query.data?.resolvedDate ?? (isToday ? "" : date);
  useDocumentTitle(resolvedDate ? `${resolvedDate} — VChat` : "VChat");

  if (!valid) return <NotFound />;

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
          <Typography color="text.secondary" sx={{ py: 8, textAlign: "center" }}>
            No data for this date
          </Typography>
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
          Failed to load daily videos.
        </Alert>
      </Container>
    );
  }

  const { resolvedDate: rd, isFallback, data } = query.data;
  const nextDisabled = rd >= todayYmdInTokyo();
  const sorted = sortVideos(data.videos, sort);

  return (
    <Container sx={{ py: 2 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
        <IconButton
          aria-label="previous day"
          onClick={() =>
            navigate({
              to: "/daily/$date",
              params: { date: addDaysYmd(rd, -1) },
              search: { sort },
            })
          }
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6">{rd}</Typography>
        <IconButton
          aria-label="next day"
          disabled={nextDisabled}
          onClick={() =>
            navigate({
              to: "/daily/$date",
              params: { date: addDaysYmd(rd, 1) },
              search: { sort },
            })
          }
        >
          <ChevronRightIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sort}
          onChange={(_, value: SortKey | null) => {
            if (value) {
              navigate({
                to: "/daily/$date",
                params: { date },
                search: { sort: value },
                replace: true,
              });
            }
          }}
        >
          <ToggleButton value="availableAt">Time</ToggleButton>
          <ToggleButton value="maxViewers">Max Viewers</ToggleButton>
          <ToggleButton value="likes">Likes</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {isFallback && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button onClick={() => query.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Today's list isn't available yet — showing {rd}.
        </Alert>
      )}

      {sorted.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Typography color="text.secondary">
            No streams started this day
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {sorted.map((video) => (
            <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <VideoCard video={video} channel={video.channel} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
