import type { ReactNode } from "react";
import { Drawer, List } from "@mui/material";
import { useRouterState } from "@tanstack/react-router";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import { RouterBox } from "../lib/createMuiLink";

export const DRAWER_WIDTH = 220;

const itemSx = (active: boolean) => ({
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  px: 2,
  py: 1.25,
  color: "inherit",
  textDecoration: "none",
  cursor: "pointer",
  bgcolor: active ? "action.selected" : "transparent",
  "&:hover": { bgcolor: "action.hover" },
});

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname, search } = useRouterState({ select: (s) => s.location });
  const sort = (search as { sort?: string }).sort;

  const label = (icon: ReactNode, text: string) => (
    <>
      {icon}
      <span>{text}</span>
    </>
  );

  return (
    <List disablePadding onClick={onNavigate}>
      <RouterBox to="/" sx={itemSx(pathname === "/")}>
        {label(<LiveTvIcon fontSize="small" />, "Live")}
      </RouterBox>
      <RouterBox to="/upcoming" sx={itemSx(pathname === "/upcoming")}>
        {label(<ScheduleIcon fontSize="small" />, "Upcoming")}
      </RouterBox>
      <RouterBox
        to="/daily/$date"
        params={{ date: "today" }}
        search={{ sort: "maxViewers" }}
        sx={itemSx(pathname === "/daily/today" && sort === "maxViewers")}
      >
        {label(<VisibilityIcon fontSize="small" />, "Top Viewers Today")}
      </RouterBox>
      <RouterBox
        to="/daily/$date"
        params={{ date: "today" }}
        search={{ sort: "likes" }}
        sx={itemSx(pathname === "/daily/today" && sort === "likes")}
      >
        {label(<ThumbUpIcon fontSize="small" />, "Top Likes Today")}
      </RouterBox>
    </List>
  );
}

interface AppSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ mobileOpen, onClose }: AppSidebarProps) {
  return (
    <>
      {/* Desktop: permanent drawer, paper offset below the sticky TopBar. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            top: "var(--topbar-h)",
            height: "auto",
            bottom: 0,
          },
        }}
      >
        <SidebarNav />
      </Drawer>
      {/* Mobile: temporary overlay drawer, closes on navigation. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <SidebarNav onNavigate={onClose} />
      </Drawer>
    </>
  );
}
