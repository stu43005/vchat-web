import { parseJSONL } from "../lib/jsonl";

const DATA_BASE = (import.meta.env.VITE_DATA_BASE as string | undefined) ?? "/data";

export class NotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`not found: ${path}`);
    this.name = "NotFoundError";
  }
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`, { cache: "default" });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchJsonl<T>(path: string): Promise<T[]> {
  const res = await fetch(`${DATA_BASE}${path}`, { cache: "default" });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  const text = await res.text();
  return parseJSONL<T>(text);
}

export async function fetchHead(path: string): Promise<boolean> {
  // `path` is an origin-rooted absolute path (e.g. "/UCxxxx/20240101_abc.html").
  // Unlike fetchJson / fetchJsonl, this does NOT prepend DATA_BASE — the legacy
  // HTML lives at the bucket root, not under /data/.
  const res = await fetch(path, { method: "HEAD", cache: "default" });
  return res.ok;
}
