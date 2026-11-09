"use client";
import { useEffect, useState } from "react";
import { formatMatchTime } from "@/lib/time";

export function Deadline({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 15000);
    return () => clearInterval(timer);
  }, []);
  const minutes =
    now === null ? null : Math.ceil((new Date(at).getTime() - now) / 60000);
  const remaining =
    minutes === null
      ? null
      : minutes <= 0
        ? "מועד הנעילה הגיע"
        : minutes < 60
          ? minutes === 1
            ? "עוד דקה לנעילה"
            : `עוד ${minutes} דקות לנעילה`
          : minutes < 1440
            ? `עוד ${Math.floor(minutes / 60) === 1 ? "שעה" : `${Math.floor(minutes / 60)} שעות`}${minutes % 60 ? (minutes % 60 === 1 ? " ודקה" : ` ו־${minutes % 60} דקות`) : ""} לנעילה`
            : Math.floor(minutes / 1440) === 1
              ? "עוד יום לנעילה"
              : `עוד ${Math.floor(minutes / 1440)} ימים לנעילה`;
  return (
    <span className="text-xs leading-6 text-[var(--text-secondary)]">
      {remaining && (
        <strong
          className={
            minutes !== null && minutes <= 60
              ? "text-[var(--gold)]"
              : "text-[var(--text-primary)]"
          }
        >
          {remaining} ·{" "}
        </strong>
      )}
      <time dateTime={at}>{formatMatchTime(at)}</time> · שעון ישראל
    </span>
  );
}
