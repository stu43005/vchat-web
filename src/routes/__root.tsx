/* eslint-disable react-refresh/only-export-components */
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Box } from "@mui/material";
import { TopBar } from "../components/TopBar";
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
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <TopBar />
      <Outlet />
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <RouterDevtools />
          <QueryDevtools />
        </Suspense>
      )}
    </Box>
  );
}
