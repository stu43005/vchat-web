import { Box, Button, Typography } from "@mui/material";
import { Link } from "@tanstack/react-router";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function NotFound() {
  useDocumentTitle("Not Found — VChat");
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 2,
      }}
    >
      <Typography variant="h4">Not Found</Typography>
      <Typography color="text.secondary">
        The page you requested does not exist.
      </Typography>
      <Button component={Link} to="/" variant="contained">
        Back to Home
      </Button>
    </Box>
  );
}
