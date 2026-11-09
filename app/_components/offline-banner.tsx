"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); };
}
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return <div role="status" aria-live="polite" className="sticky top-0 z-50 bg-[var(--surface-card)] px-4 py-2 text-center text-xs text-[var(--text-primary)]">אין חיבור לרשת — התחזיות יישמרו רק לאחר חזרת החיבור</div>;
}
