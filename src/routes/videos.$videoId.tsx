import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Container,
  Skeleton,
  Typography,
} from "@mui/material";
import { z } from "zod";
import { useVideoMetaQuery, useVideoRowsQuery } from "../api/queries";
import { NotFoundError } from "../api/client";
import { VideoHeader } from "../components/VideoHeader";
import { CurrencyTable } from "../components/CurrencyTable";
import { FilterChips } from "../components/FilterChips";
import { ChatList } from "../components/ChatList";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useTimezonePref } from "../lib/settings";
import type { FilterableType } from "../api/types";

const filterableTypeEnum = z.enum([
  "chat",
  "superChat",
  "superSticker",
  "membership",
  "membershipGift",
  "membershipGiftPurchase",
  "milestone",
  "poll",
  "raid",
]);

const videoSearchSchema = z.object({
  types: z.array(filterableTypeEnum).optional(),
  sigRange: z
    .tuple([z.number().int().min(1).max(7), z.number().int().min(1).max(7)])
    .refine(([lo, hi]) => lo <= hi, { message: "lo must be <= hi" })
    .optional(),
  // Legacy redirect hints (channelId + YYYYMMDD). `.catch(undefined)` so a stale URL stays navigable.
  c: z.string().min(1).optional().catch(undefined),
  d: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/videos/$videoId")({
  validateSearch: videoSearchSchema,
  component: VideoPage,
});

const DEFAULT_TYPES: FilterableType[] = ["superChat", "superSticker"];
const DEFAULT_SIG_RANGE: [number, number] = [1, 7];

function VideoPage() {
  const { videoId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/videos/$videoId" });
  const [timezone] = useTimezonePref();

  const meta = useVideoMetaQuery(videoId);
  const rows = useVideoRowsQuery(videoId);

  useDocumentTitle(meta.data ? `${meta.data.title} — VChat` : "VChat");

  const selectedTypes = search.types ?? DEFAULT_TYPES;
  const sigRange = search.sigRange ?? DEFAULT_SIG_RANGE;

  // Meta error takes precedence (so a 404 surfaces "Archive not yet
  // available" immediately rather than after a skeleton flash).
  if (meta.isError) {
    if (meta.error instanceof NotFoundError) {
      return (
        <Container sx={{ py: 2 }}>
          <Alert severity="warning" sx={{ maxWidth: 640 }}>
            <strong>Archive not yet available</strong>
            <div>
              This video has not yet been archived in the new format. If you have
              an older link, the legacy archive may be available.
            </div>
          </Alert>
        </Container>
      );
    }
    return (
      <Container sx={{ py: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => meta.refetch()} size="small">
              Retry
            </Button>
          }
        >
          Failed to load video.
        </Alert>
      </Container>
    );
  }

  if (meta.isPending || rows.isPending) {
    return (
      <Container sx={{ py: 2 }}>
        <Skeleton variant="rectangular" height={160} sx={{ mb: 2 }} />
        <Skeleton width={400} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={56} sx={{ mb: 0.5 }} />
        ))}
      </Container>
    );
  }

  const video = meta.data;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box>
        <VideoHeader video={video} timezone={timezone} />
        <CurrencyTable
          currencies={video.aggregates.currencyTable}
          jpyTotal={video.aggregates.jpyTotal}
        />
        <FilterChips
          aggregates={video.aggregates}
          selectedTypes={selectedTypes}
          onTypesChange={(next) =>
            navigate({
              search: { ...search, types: next },
              replace: true,
              resetScroll: false,
            })
          }
          sigRange={sigRange}
          onSigRangeChange={(next) =>
            navigate({
              search: { ...search, sigRange: next },
              replace: true,
              resetScroll: false,
            })
          }
        />
      </Box>
      {rows.isError ? (
        rows.error instanceof NotFoundError ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              No chat rows archived for this video
            </Typography>
          </Box>
        ) : (
          <Alert
            severity="error"
            action={
              <Button onClick={() => rows.refetch()} size="small">
                Retry
              </Button>
            }
            sx={{ my: 2 }}
          >
            Failed to load chat rows.
          </Alert>
        )
      ) : (
        <ChatList
          rows={rows.data}
          video={video}
          selectedTypes={selectedTypes}
          sigRange={sigRange}
          timezone={timezone}
        />
      )}
    </Container>
  );
}
