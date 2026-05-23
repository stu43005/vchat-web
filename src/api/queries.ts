import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchJson, fetchJsonl, NotFoundError } from "./client";
import type {
  ChannelData,
  ChatRow,
  IndexData,
  VideoMeta,
} from "./types";

const retryOnNon404 = (failureCount: number, error: Error) =>
  !(error instanceof NotFoundError) && failureCount < 3;

export function useIndexQuery(): UseQueryResult<IndexData> {
  return useQuery({
    queryKey: ["index"],
    queryFn: () => fetchJson<IndexData>("/index.json"),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: retryOnNon404,
  });
}

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
    enabled: Boolean(videoId),
  });
}
