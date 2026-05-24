import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  AppBar,
  Box,
  Breadcrumbs,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import { Link, useMatch } from "@tanstack/react-router";
import {
  useResolvedTheme,
  useToggleTheme,
  useTimezonePref,
} from "../lib/settings";
import type { TimezonePref } from "../lib/format";
import { useChannelQuery, useVideoMetaQuery } from "../api/queries";
import { RouterBox } from "../lib/createMuiLink";

type Crumb =
  | { label: string; kind: "home" }
  | { label: string; kind: "channel"; channelId: string }
  | { label: string; kind: "video" };

function useBreadcrumbs(): Crumb[] {
  // Loose matches: returns null when the route is not active, so the
  // hook can call useChannelQuery / useVideoMetaQuery unconditionally
  // (queries are enabled only when there's an id to fetch).
  const channelMatch = useMatch({
    from: "/channels/$channelId",
    shouldThrow: false,
  });
  const videoMatch = useMatch({
    from: "/videos/$videoId",
    shouldThrow: false,
  });

  const channelId = channelMatch?.params.channelId;
  const videoId = videoMatch?.params.videoId;

  const channelQuery = useChannelQuery(channelId);
  const videoQuery = useVideoMetaQuery(videoId);

  const crumbs: Crumb[] = [{ label: "Home", kind: "home" }];

  if (channelId) {
    crumbs.push({
      label: channelQuery.data?.name ?? "…",
      kind: "channel",
      channelId,
    });
  }
  if (videoId) {
    if (videoQuery.data) {
      crumbs.push({
        label: videoQuery.data.channel.name,
        kind: "channel",
        channelId: videoQuery.data.channel.id,
      });
      crumbs.push({ label: videoQuery.data.title, kind: "video" });
    } else {
      crumbs.push({ label: "…", kind: "video" });
    }
  }

  return crumbs;
}

const TIMEZONES: TimezonePref[] = ["local", "Asia/Tokyo", "UTC"];
const TIMEZONE_LABELS: Record<TimezonePref, string> = {
  local: "Local",
  "Asia/Tokyo": "Asia/Tokyo",
  UTC: "UTC",
};

function CrumbLink({ crumb }: { crumb: Crumb }) {
  const baseSx = {
    color: "inherit",
    textDecoration: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 320,
    display: "inline-block",
    verticalAlign: "bottom",
  };
  const linkSx = { ...baseSx, cursor: "pointer" };
  if (crumb.kind === "home") {
    return (
      <RouterBox to="/" sx={linkSx}>
        {crumb.label}
      </RouterBox>
    );
  }
  if (crumb.kind === "channel") {
    return (
      <RouterBox
        to="/channels/$channelId"
        params={{ channelId: crumb.channelId }}
        sx={linkSx}
      >
        {crumb.label}
      </RouterBox>
    );
  }
  return <Box sx={baseSx}>{crumb.label}</Box>;
}

export function TopBar() {
  const appBarRef = useRef<HTMLDivElement>(null);
  const [timezone, setTimezone] = useTimezonePref();
  const resolvedTheme = useResolvedTheme();
  const toggleTheme = useToggleTheme();
  const [tzAnchor, setTzAnchor] = useState<HTMLElement | null>(null);
  const crumbs = useBreadcrumbs();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  useEffect(() => {
    const el = appBarRef.current;
    if (!el) return;
    const write = () => {
      document.documentElement.style.setProperty(
        "--topbar-h",
        `${el.offsetHeight}px`,
      );
    };
    write();
    const obs = new ResizeObserver(write);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const visibleCrumbs = isMobile ? [crumbs[crumbs.length - 1]] : crumbs;

  return (
    <AppBar ref={appBarRef} position="sticky" color="default" elevation={1}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
        >
          VChat
        </Typography>
        <Breadcrumbs sx={{ flexGrow: 1, minWidth: 0 }} maxItems={4}>
          {visibleCrumbs.map((c, i) => (
            <CrumbLink key={i} crumb={c} />
          ))}
        </Breadcrumbs>
        <IconButton
          onClick={(e: MouseEvent<HTMLElement>) => setTzAnchor(e.currentTarget)}
          aria-label="timezone"
        >
          <AccessTimeIcon />
        </IconButton>
        <Menu
          anchorEl={tzAnchor}
          open={Boolean(tzAnchor)}
          onClose={() => setTzAnchor(null)}
        >
          {TIMEZONES.map((tz) => (
            <MenuItem
              key={tz}
              selected={tz === timezone}
              onClick={() => {
                setTimezone(tz);
                setTzAnchor(null);
              }}
            >
              {TIMEZONE_LABELS[tz]}
            </MenuItem>
          ))}
        </Menu>
        <IconButton onClick={toggleTheme} aria-label="toggle theme">
          {resolvedTheme === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
