import { useSyncExternalStore } from "react";

// A single shared 1s clock. The interval runs only while at least one
// component is subscribed (i.e. at least one live-elapsed badge is mounted).
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (timer === null) {
    // Refresh immediately so the first render after subscribing uses a
    // current timestamp rather than a stale module-load value.
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return now;
}

// Returns the current epoch-ms snapshot and re-renders once per second.
export function useNowTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
