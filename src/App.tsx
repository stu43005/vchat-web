import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { lightTheme, darkTheme } from "./theme";
import { useResolvedTheme } from "./lib/settings";
import { router } from "./router";

const queryClient = new QueryClient();

export function App() {
  const mode = useResolvedTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={mode === "dark" ? darkTheme : lightTheme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
