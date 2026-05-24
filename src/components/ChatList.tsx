import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { ChatRow, FilterableType, VideoMeta } from "../api/types";
import type { TimezonePref } from "../lib/format";
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
}

export function ChatList(props: ChatListProps) {
  const { rows, video, selectedTypes, sigRange, timezone } = props;

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

  // Window virtualization: the page itself scrolls. We need to tell the
  // virtualizer how far the list starts from the top of the document so it
  // can place items at the right viewport offsets.
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(document.documentElement);
    window.addEventListener("resize", update);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: filtered.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    overscan: 8,
    scrollMargin,
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
      ref={parentRef}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <Box sx={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {/* Block-translate: one transform on the wrapper instead of N per-item
            transforms. Items stack in normal flow under the offset wrapper. */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${(items[0]?.start ?? 0) - scrollMargin}px)`,
          }}
        >
          {items.map((item) => (
            <Box
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
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
    </Box>
  );
}
