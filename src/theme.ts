import { createTheme, type Theme } from "@mui/material/styles";

export const CHATLIST_PAD_PX = 16;

const baseOptions = {
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
};

export const lightTheme: Theme = createTheme({
  ...baseOptions,
  palette: { mode: "light" },
});

export const darkTheme: Theme = createTheme({
  ...baseOptions,
  palette: { mode: "dark" },
});
