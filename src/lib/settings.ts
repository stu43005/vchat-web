import { useEffect, useState } from "react";
import type { TimezonePref } from "./format";

export type ThemePref = "light" | "dark" | "system";

const TZ_KEY = "vchat:timezone";
const THEME_KEY = "vchat:theme";

const isTimezone = (v: unknown): v is TimezonePref =>
  v === "local" || v === "Asia/Tokyo" || v === "UTC";

const isTheme = (v: unknown): v is ThemePref =>
  v === "light" || v === "dark" || v === "system";

function readStored<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return guard(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function useTimezonePref(): [TimezonePref, (next: TimezonePref) => void] {
  const [value, setValue] = useState<TimezonePref>(() =>
    readStored<TimezonePref>(TZ_KEY, isTimezone, "local"),
  );
  useEffect(() => {
    try {
      localStorage.setItem(TZ_KEY, value);
    } catch {
      /* localStorage unavailable */
    }
  }, [value]);
  return [value, setValue];
}

export function useThemePref(): [ThemePref, (next: ThemePref) => void] {
  const [value, setValue] = useState<ThemePref>(() =>
    readStored<ThemePref>(THEME_KEY, isTheme, "system"),
  );
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      /* localStorage unavailable */
    }
  }, [value]);
  return [value, setValue];
}

export function useResolvedTheme(): "light" | "dark" {
  const [pref] = useThemePref();
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref]);
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemDark ? "dark" : "light";
}
