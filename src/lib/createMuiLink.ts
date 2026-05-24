import { createLink } from "@tanstack/react-router";
import { Box, CardActionArea, Chip } from "@mui/material";
import { styled } from "@mui/material/styles";

export const RouterBox = createLink(Box);
export const RouterCardActionArea = createLink(CardActionArea);
export const RouterChip = createLink(Chip);

// Anchor that supports `sx` (via MUI styled) and TanStack Router params/to.
// Use when an actual <a> element is required — e.g. overlay card links that
// need middle-click / right-click "open in new tab" support.
const StyledAnchor = styled("a")({});
export const RouterAnchor = createLink(StyledAnchor);
