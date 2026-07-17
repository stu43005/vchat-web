import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Box } from "@mui/material";
import { useState } from "react";
import { TopBar } from "../components/TopBar";
import { AppSidebar } from "../components/AppSidebar";
import { NotFound } from "../components/NotFound";
import { lazy, Suspense } from "react";

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;

const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null;

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <TopBar onMenuClick={() => setMobileOpen(true)} />
      <Box sx={{ display: "flex" }}>
        <AppSidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <RouterDevtools />
          <QueryDevtools />
        </Suspense>
      )}
    </Box>
  );
}
