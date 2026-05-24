import { z } from "zod";
import { warnOnce } from "./warn";

const rowTypeSchema = z.object({
  type: z.enum([
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
  ]),
});

export function parseJSONL<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch (err) {
      warnOnce("malformed JSONL line", err instanceof Error ? err.message : String(err));
      continue;
    }
    const parsed = rowTypeSchema.safeParse(raw);
    if (!parsed.success) {
      warnOnce("invalid row type", parsed.error.issues[0]?.message ?? "unknown");
      continue;
    }
    out.push(raw as T);
  }
  return out;
}
