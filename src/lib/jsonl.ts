import type { ChatRow } from "../api/types";
import { warnOnce } from "./warn";

const KNOWN_TYPES: ReadonlySet<ChatRow["type"]> = new Set([
  "chat",
  "superChat",
  "superSticker",
  "membership",
  "membershipGift",
  "membershipGiftPurchase",
  "milestone",
  "poll",
  "raid",
  "raidOutgoing",
]);

export function parseJSONL<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const row = JSON.parse(line) as { type?: string };
    if (
      typeof row.type === "string" &&
      !KNOWN_TYPES.has(row.type as ChatRow["type"])
    ) {
      warnOnce("unknown row type", row.type);
      continue;
    }
    out.push(row as T);
  }
  return out;
}
