import { useEffect, useMemo, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatRow, FilterableType, VideoMeta } from "../api/types";
import type { TimezonePref } from "../lib/format";
import { CHATLIST_PAD_PX } from "../theme";
import { RowDispatcher } from "./chat-rows/RowDispatcher";

// Initial-render estimate for unmeasured rows. The virtualizer replaces
// each row's height with the real measurement as it scrolls into view.
const ESTIMATED_ROW_HEIGHT_PX = 64;

interface ChatListProps {
  rows: ChatRow[];
  video: VideoMeta;
  selectedTypes: FilterableType[];
  sigRange: [number, number];
  timezone: TimezonePref;
  headerHeight: number;
}

export function ChatList(props: ChatListProps) {
  const { rows, video, selectedTypes, sigRange, timezone, headerHeight } = props;

  const filtered = useMemo<ChatRow[]>(() => {
    const typeSet = new Set<FilterableType>(selectedTypes);
    const raidGroup = typeSet.has("raid");
    return rows.filter((row) => {
      if (row.type === "raidOutgoing") return raidGroup;
      if (!typeSet.has(row.type)) return false;
      if (row.type === "superChat" || row.type === "superSticker") {
        const sig = row.significance ?? 0;
        return sig >= sigRange[0] && sig <= sigRange[1];
      }
      return true;
    });
  }, [rows, selectedTypes, sigRange]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--chatlist-height",
      `calc(100vh - var(--topbar-h, 64px) - ${headerHeight}px - ${CHATLIST_PAD_PX}px)`,
    );
    return () => {
      document.documentElement.style.removeProperty("--chatlist-height");
    };
  }, [headerHeight]);

  // useVirtualizer trips react-hooks/incompatible-library (the rule has a
  // hardcoded incompatible-library list, no configurable allowlist).
  // Suppression is what TanStack's own tanstack.com codebase does — see
  // upstream issue TanStack/virtual#1119. Revisit once that is resolved
  // or if this project ever opts into React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    overscan: 8,
  });

  if (selectedTypes.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography color="text.secondary">No row types selected</Typography>
      </Box>
    );
  }

  if (filtered.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography color="text.secondary">No rows match the current filters</Typography>
      </Box>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <Box
      ref={containerRef}
      sx={{
        height: "var(--chatlist-height)",
        overflow: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <Box sx={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {items.map((item) => (
          <Box
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${item.start}px)`,
            }}
          >
            <RowDispatcher
              row={filtered[item.index]}
              no={item.index + 1}
              video={video}
              timezone={timezone}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
