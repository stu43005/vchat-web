const warned = new Set<string>();

// Truncate the dedup key so a pathologically long detail can't bloat
// memory. The full detail still appears in the logged warning — only
// the in-memory dedup key is capped.
const KEY_MAX = 200;

export function warnOnce(label: string, detail: string): void {
  const raw = `${label}:${detail}`;
  const key = raw.length > KEY_MAX ? raw.slice(0, KEY_MAX) : raw;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[vchat] ${label}: ${detail}`);
}
