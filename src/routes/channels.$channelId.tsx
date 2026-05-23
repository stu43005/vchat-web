import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/channels/$channelId")({
  component: () => null,
});
