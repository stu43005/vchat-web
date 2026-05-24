import { useEffect } from "react";

// No restore-on-unmount: with route preloading, two mounted components
// would race over `prev` and the unmounting one would clobber the
// surviving title. Each route sets its own title; if a route forgets,
// the stale title is the lesser evil vs the race.
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
