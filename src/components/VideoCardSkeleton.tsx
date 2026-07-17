import { Box, Card, CardContent, Skeleton } from "@mui/material";

interface VideoCardSkeletonProps {
  /** Mirror VideoCard's hideChannel: drop the channel avatar row. */
  hideChannel?: boolean;
}

// Placeholder that mirrors VideoCard's layout so the pending grid keeps the
// same shape as the loaded list. Keep the structure in sync with
// VideoCard.tsx: thumbnail -> title (2 lines) -> channel row -> footer stats.
export function VideoCardSkeleton({ hideChannel = false }: VideoCardSkeletonProps) {
  return (
    <Card sx={{ position: "relative" }}>
      {/* Box owns the 16/9 ratio; the Skeleton fills it. Setting aspectRatio
          on the Skeleton alone collapses it — it has no intrinsic height. */}
      <Box sx={{ aspectRatio: "16/9" }}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </Box>
      <CardContent sx={{ pb: 1 }}>
        {/* Two lines, matching the subtitle1 2-line clamp (minHeight 2.6em). */}
        <Box sx={{ minHeight: "2.6em" }}>
          <Skeleton variant="text" sx={{ fontSize: "1rem" }} width="100%" />
          <Skeleton variant="text" sx={{ fontSize: "1rem" }} width="70%" />
        </Box>
      </CardContent>
      {!hideChannel && (
        <CardContent sx={{ pt: 0, pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="text" width="45%" sx={{ fontSize: "0.875rem" }} />
          </Box>
        </CardContent>
      )}
      <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: "divider" }}>
        <Skeleton variant="text" width="75%" sx={{ fontSize: "0.8125rem" }} />
      </Box>
    </Card>
  );
}
