"use client";
import { useState } from "react";
import {
  createSummaryImage,
  type SummaryVisual,
} from "@/lib/notifications/summary-image";
export function ShareSummary({
  body,
  visual,
}: {
  body: string;
  visual?: SummaryVisual;
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function exportImage() {
    if (!visual) return;
    setBusy(true);
    setStatus("");
    try {
      const blob = await createSummaryImage(visual);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ScoreRush-${visual.day}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus("התמונה מוכנה. אפשר לצרף אותה לקבוצת הוואטסאפ.");
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "יצירת התמונה נכשלה. נסו שוב.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-3">
      {visual && (
        <button
          disabled={busy}
          onClick={() => void exportImage()}
          className="action-primary disabled:opacity-50"
        >
          {busy ? "מכין תמונה…" : "הורדת תמונה לקבוצה ↓"}
        </button>
      )}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(body)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-11 content-center rounded-xl bg-emerald-400 px-4 text-sm font-bold text-[#080B14]"
      >
        שיתוף הסיכום בוואטסאפ
      </a>
      <button
        className="min-h-11 px-3 text-sm text-[var(--interactive)]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(body);
            setCopied(true);
          } catch {
            setCopied(false);
            setStatus("ההעתקה לא זמינה. אפשר להשתמש בכפתור השיתוף בוואטסאפ.");
          }
        }}
      >
        {copied ? "הועתק" : "העתקת הסיכום"}
      </button>
      {status && (
        <p
          role="status"
          className="w-full text-xs leading-6 text-[var(--text-secondary)]"
        >
          {status}
        </p>
      )}
    </div>
  );
}
