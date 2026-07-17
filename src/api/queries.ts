import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchJson, fetchJsonl, NotFoundError } from "./client";
import type {
  ChannelData,
  ChatRow,
  DailyVideos,
  RealtimeIndex,
  UpcomingIndex,
  VideoMeta,
} from "./types";
import { addDaysYmd, todayYmdInTokyo } from "../lib/format";

const retryOnNon404 = (failureCount: number, error: Error) =>
  !(error instanceof NotFoundError) && failureCount < 3;

export function useChannelQuery(
  channelId: string | undefined,
): UseQueryResult<ChannelData> {
  return useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => fetchJson<ChannelData>(`/channels/${channelId}.json`),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
    enabled: Boolean(channelId),
  });
}

export function useVideoMetaQuery(
  videoId: string | undefined,
): UseQueryResult<VideoMeta> {
  return useQuery({
    queryKey: ["videoMeta", videoId],
    queryFn: () => fetchJson<VideoMeta>(`/videos/${videoId}.meta.json`),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: retryOnNon404,
    // Archives are immutable; window-focus refetch on an errored (404)
    // query would reset status to 'pending' and flash the Skeleton.
    refetchOnWindowFocus: false,
    enabled: Boolean(videoId),
  });
}

export function useVideoRowsQuery(
  videoId: string | undefined,
): UseQueryResult<ChatRow[]> {
  return useQuery({
    queryKey: ["videoRows", videoId],
    queryFn: () => fetchJsonl<ChatRow>(`/videos/${videoId}.jsonl`),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: retryOnNon404,
    refetchOnWindowFocus: false,
    enabled: Boolean(videoId),
  });
}

export function useRealtimeQuery(): UseQueryResult<RealtimeIndex> {
  return useQuery({
    queryKey: ["realtime"],
    queryFn: () => fetchJson<RealtimeIndex>("/realtime.json"),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
    refetchOnWindowFocus: false,
  });
}

export function useUpcomingQuery(): UseQueryResult<UpcomingIndex> {
  return useQuery({
    queryKey: ["upcoming"],
    queryFn: () => fetchJson<UpcomingIndex>("/upcoming.json"),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
    refetchOnWindowFocus: false,
  });
}

export interface DailyVideosResult {
  resolvedDate: string;
  isFallback: boolean;
  data: DailyVideos;
}

// `dateParam` is the raw route param: the literal "today" or a "YYYY-MM-DD".
// For "today", fetch the current JST day; on 404 fall back once to the
// previous JST day (isFallback=true). Concrete dates never fall back.
export function useDailyVideosQuery(
  dateParam: string | undefined,
): UseQueryResult<DailyVideosResult> {
  return useQuery({
    queryKey: ["daily", dateParam],
    queryFn: async (): Promise<DailyVideosResult> => {
      if (dateParam === "today") {
        const today = todayYmdInTokyo();
        try {
          const data = await fetchJson<DailyVideos>(
            `/daily-videos/${today}.json`,
          );
          return { resolvedDate: today, isFallback: false, data };
        } catch (err) {
          if (err instanceof NotFoundError) {
            const yesterday = addDaysYmd(today, -1);
            const data = await fetchJson<DailyVideos>(
              `/daily-videos/${yesterday}.json`,
            );
            return { resolvedDate: yesterday, isFallback: true, data };
          }
          throw err;
        }
      }
      const date = dateParam as string;
      const data = await fetchJson<DailyVideos>(`/daily-videos/${date}.json`);
      return { resolvedDate: date, isFallback: false, data };
    },
    // Result-dependent staleness: a fallback (yesterday) result is always
    // stale so the next mount of /daily/today re-attempts today's file.
    // Supported by @tanstack/react-query 5.x (StaleTimeFunction).
    staleTime: (query) => (query.state.data?.isFallback ? 0 : 60_000),
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
    refetchOnWindowFocus: false,
    enabled: Boolean(dateParam),
  });
}
