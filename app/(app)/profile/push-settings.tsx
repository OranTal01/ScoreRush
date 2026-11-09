"use client";
import { useEffect, useState } from "react";
import { defaultPreferences } from "@/lib/notifications/policy";
import type { PushPreferences } from "@/lib/db/schema/push";

async function request(body: unknown, method = "POST") {
  const response = await fetch("/api/push", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.error)
    throw new Error(result.error || "הבקשה נכשלה");
  return result;
}
function keyBytes(value: string) {
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export function PushSettings({
  onEnabledChange,
}: { onEnabledChange?: (enabled: boolean) => void } = {}) {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<PushPreferences>(defaultPreferences);
  const [liveAccess, setLiveAccess] = useState("delayed");
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    onEnabledChange?.(enabled);
  }, [enabled, onEnabledChange]);
  const [status, setStatus] = useState("בודק זמינות התראות…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    async function init() {
      const ios =
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (ios && !window.matchMedia("(display-mode: standalone)").matches) {
        setStatus(
          "באייפון: פתחו ב־Safari, לחצו על שיתוף ← הוספה למסך הבית. פתחו את ScoreRush מהסמל החדש וחזרו לכאן להפעלת ההתראות.",
        );
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus(
          "הדפדפן הזה אינו תומך בהתראות. נסו לפתוח בדפדפן רגיל בטלפון.",
        );
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await navigator.serviceWorker.ready;
        const config = await (await fetch("/api/push")).json();
        const sub = await reg.pushManager.getSubscription();
        const saved = sub
          ? await request({ read: true, endpoint: sub.endpoint })
          : null;
        if (!alive) return;
        setRegistration(reg);
        setPublicKey(config.publicKey);
        setLiveAccess(config.liveAccess ?? "delayed");
        setSubscription(sub);
        if (saved?.preferences) {
          setPreferences({ ...defaultPreferences, ...saved.preferences });
          setEnabled(true);
        }
        setStatus(
          config.publicKey
            ? "בחרו אילו עדכונים יגיעו למכשיר הזה. אפשר לכבות בכל רגע."
            : "הפעלת ההתראות עדיין בהכנה. אפשר לחזור לכאן בקרוב.",
        );
      } catch {
        if (alive) setStatus("לא הצלחנו לטעון את ההתראות. רעננו ונסו שוב.");
      }
    }
    void init();
    return () => {
      alive = false;
    };
  }, []);
  async function subscribe() {
    if (!registration || !publicKey) return;
    setBusy(true);
    try {
      const sub =
        subscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      setSubscription(sub);
      await request({ ...sub.toJSON(), preferences });
      setEnabled(true);
      setStatus("ההתראות הופעלו במכשיר הזה. תוכלו לשלוח התראת בדיקה.");
    } catch {
      setStatus(
        Notification.permission === "denied"
          ? "ההתראות חסומות בהגדרות הדפדפן או המכשיר. אפשרו אותן ואז נסו שוב."
          : "ההתראות לא הופעלו. בדקו את החיבור ונסו שוב.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function update(next: PushPreferences) {
    if (!subscription) return;
    setBusy(true);
    try {
      await request({ ...subscription.toJSON(), preferences: next });
      setPreferences(next);
      setStatus("העדפות ההתראות נשמרו.");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    if (!subscription) return;
    setBusy(true);
    try {
      await request({ endpoint: subscription.endpoint }, "DELETE");
      await subscription.unsubscribe();
      setSubscription(null);
      setEnabled(false);
      setStatus("ההתראות במכשיר הזה כבויות.");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--surface-card)] p-4">
      <h2 className="text-base font-bold">התראות לטלפון 🔔</h2>
      <p
        role="status"
        className="mt-2 text-sm leading-6 text-[var(--text-secondary)]"
      >
        {status}
      </p>
      {liveAccess === "delayed" && (
        <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
          התראות שערים וכרטיסים ממתינות להפעלת שירות הלייב בטורניר. תזכורות
          וסיכומים זמינים כרגיל.
        </p>
      )}
      {enabled ? (
        <div className="mt-3 space-y-2">
          {(
            [
              {
                key: "reminders",
                label: "תזכורות לניחושים חסרים — יום לפני וביום המשחקים",
              },
              { key: "summaries", label: "סיכום ערב המשחקים והטבלה" },
              { key: "kickoff", label: "תחילת ערב המשחקים" },
              { key: "finished", label: "סיום כל משחק" },
              { key: "goals", label: "שערים ותיקוני תוצאה במשחקי הטורניר" },
              { key: "redCards", label: "כרטיסים אדומים ותיקוני דיווח" },
            ] as const
          ).map((option) => (
            <label
              key={option.key}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                disabled={
                  busy ||
                  (option.key === "goals" && liveAccess === "delayed") ||
                  (option.key === "redCards" && liveAccess !== "events")
                }
                checked={!!preferences[option.key]}
                onChange={(e) =>
                  void update({
                    ...preferences,
                    [option.key]: e.target.checked,
                  })
                }
              />
              {option.label}
            </label>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request({
                    test: true,
                    endpoint: subscription?.endpoint,
                  });
                  setStatus("התראת הבדיקה נשלחה למכשיר.");
                } catch (err) {
                  setStatus((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="min-h-11 rounded-xl border border-[var(--interactive)] px-3 text-sm text-[var(--interactive)]"
            >
              שליחת התראת בדיקה
            </button>
            <button
              disabled={busy}
              onClick={() => void disable()}
              className="min-h-11 px-3 text-sm text-[var(--text-secondary)]"
            >
              כיבוי ההתראות
            </button>
          </div>
        </div>
      ) : (
        publicKey &&
        registration && (
          <button
            disabled={busy}
            onClick={() => void subscribe()}
            className="mt-3 min-h-12 w-full rounded-xl bg-[var(--interactive)] px-4 font-bold text-[#080B14]"
          >
            {busy ? "מפעיל…" : "הפעלת התראות במכשיר הזה"}
          </button>
        )
      )}
    </section>
  );
}
