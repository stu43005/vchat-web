import { Avatar, Box, Typography, type SxProps } from "@mui/material";
import type { ReactNode } from "react";

const GRID_TEMPLATE = "56px 180px 56px 200px 1fr";

interface ChatRowBaseProps {
  no: number;
  timestamp: ReactNode;
  photo?: string | null;
  author: ReactNode;
  body: ReactNode;
  bodySx?: SxProps;
}

export function ChatRowBase(props: ChatRowBaseProps) {
  const { no, timestamp, photo, author, body, bodySx } = props;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems: "center",
        columnGap: 1,
        py: 1,
        px: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ textAlign: "right", color: "text.secondary" }}>
        {no}
      </Typography>
      <Box>{timestamp}</Box>
      <Box>
        {photo ? (
          <Avatar
            src={photo}
            alt=""
            slotProps={{ img: { loading: "lazy", referrerPolicy: "no-referrer" } }}
            sx={{ width: 40, height: 40 }}
          />
        ) : null}
      </Box>
      <Typography variant="body2" noWrap>
        {author}
      </Typography>
      <Box sx={bodySx}>{body}</Box>
    </Box>
  );
}
