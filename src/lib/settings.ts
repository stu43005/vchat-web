import { useCallback, useSyncExternalStore } from "react";
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

// Module-level subscriber store so every component that reads a pref
// re-renders when any other component (e.g. TopBar) writes it.
function createPrefStore<T extends string>(
  key: string,
  guard: (v: unknown) => v is T,
  fallback: T,
) {
  let value: T = readStored(key, guard, fallback);
  const listeners = new Set<() => void>();
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  const getSnapshot = () => value;
  const setValue = (next: T) => {
    if (next === value) return;
    value = next;
    try {
      localStorage.setItem(key, next);
    } catch {
      /* localStorage unavailable */
    }
    listeners.forEach((l) => l());
  };
  return { subscribe, getSnapshot, setValue };
}

const timezoneStore = createPrefStore<TimezonePref>(TZ_KEY, isTimezone, "local");
const themeStore = createPrefStore<ThemePref>(THEME_KEY, isTheme, "system");

export function useTimezonePref(): [TimezonePref, (next: TimezonePref) => void] {
  const value = useSyncExternalStore(timezoneStore.subscribe, timezoneStore.getSnapshot);
  return [value, timezoneStore.setValue];
}

export function useThemePref(): [ThemePref, (next: ThemePref) => void] {
  const value = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return [value, themeStore.setValue];
}

const DARK_MQ = "(prefers-color-scheme: dark)";

function subscribePrefersDark(callback: () => void): () => void {
  const mq = window.matchMedia(DARK_MQ);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getPrefersDark(): boolean {
  return window.matchMedia(DARK_MQ).matches;
}

export function useResolvedTheme(): "light" | "dark" {
  const [pref] = useThemePref();
  const systemDark = useSyncExternalStore(subscribePrefersDark, getPrefersDark);
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

// Toggle between dark/light. If pref is currently "system", flip away from
// the current resolved theme (system dark → light, system light → dark).
export function useToggleTheme(): () => void {
  const [pref, setTheme] = useThemePref();
  const resolved = useResolvedTheme();
  return useCallback(() => {
    const current = pref === "system" ? resolved : pref;
    setTheme(current === "dark" ? "light" : "dark");
  }, [pref, resolved, setTheme]);
}
