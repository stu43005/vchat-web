import { RouterProvider } from "@tanstack/react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { lightTheme, darkTheme } from "./theme";
import { useResolvedTheme } from "./lib/settings";
import { router } from "./router";

export function ThemedApp() {
  const mode = useResolvedTheme();
  return (
    <ThemeProvider theme={mode === "dark" ? darkTheme : lightTheme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
