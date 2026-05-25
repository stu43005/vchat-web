import { Alert, Button, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { fetchHead } from "../api/client";

interface LegacyArchiveAlertProps {
  videoId: string;
  channelId: string | undefined;
  dateYmd: string | undefined;
}

export function LegacyArchiveAlert({
  videoId,
  channelId,
  dateYmd,
}: LegacyArchiveAlertProps) {
  const enabled = Boolean(channelId && dateYmd);
  // dateYmd is already YYYYMMDD and channelId is the bare id, so a template
  // literal yields the legacy path directly.
  const legacyPath = enabled
    ? `/${channelId}/${dateYmd}_${videoId}.html`
    : "";

  const query = useQuery({
    queryKey: ["legacyHead", videoId, channelId, dateYmd],
    queryFn: () => fetchHead(legacyPath),
    enabled,
    retry: false,
    staleTime: Infinity,
  });

  if (enabled && query.data === true) {
    return (
      <Alert
        severity="info"
        sx={{ maxWidth: 640 }}
        action={
          <Button
            variant="outlined"
            size="small"
            component="a"
            href={legacyPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open legacy archive
          </Button>
        }
      >
        <strong>Legacy archive available</strong>
        <div>
          An older HTML archive of this video is available. The new chat view
          is not yet generated.
        </div>
      </Alert>
    );
  }

  // When `enabled: false`, useQuery reports `isPending: true` with
  // `fetchStatus: 'idle'`. Gate on `enabled` so the spinner only renders
  // while a probe is actually in flight.
  const showSpinner = enabled && query.isPending;

  return (
    <Alert severity="warning" sx={{ maxWidth: 640 }}>
      <strong>Archive not yet available</strong>
      <div>
        This video has not yet been archived in the new format. If you have an
        older link, the legacy archive may be available.
        {showSpinner && (
          <CircularProgress
            size={16}
            sx={{ ml: 1, verticalAlign: "middle" }}
          />
        )}
      </div>
    </Alert>
  );
}
