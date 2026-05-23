// Hook for detecting viewport-is-mobile. Subscribes to the media query and
// re-renders consumers when it flips. Uses `useSyncExternalStore` — the React-
// recommended primitive for external-store subscriptions — which avoids the
// react-hooks/set-state-in-effect lint error you get with the naive
// useEffect+setState approach.

import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(notify: () => void) {
  if (typeof window === "undefined") return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", notify)
  return () => mql.removeEventListener("change", notify)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  // SSR has no viewport — default to desktop. Hydration will reconcile.
  return false
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
