import type { ReactNode } from "react";
import { colors } from "@/lib/design-tokens";

/** Base elevated surface used by nearly every screen (Premium Fantasy Refined card). */
export function Card({
  children,
  className = "",
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  padding?: "default" | "compact" | "hero";
}) {
  const paddingStyle =
    padding === "hero"
      ? "var(--spacing-card-padding-hero, 18px)"
      : padding === "compact"
        ? "10px"
        : "16px";
  return (
    <div
      className={`border border-[var(--border)] bg-[var(--surface-card)] ${className}`}
      style={{ borderRadius: "var(--radius-card)", padding: paddingStyle }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-extrabold tracking-wide text-[var(--text-secondary)]">
        {title}
      </h2>
      {action}
    </div>
  );
}

const RANK_RING: Record<number, string> = {
  1: "linear-gradient(135deg, #D6B56E, #B89350)",
  2: "linear-gradient(135deg, #AEB6C2, #7C8696)",
  3: "linear-gradient(135deg, #C9A876, #8F6D42)",
};

/** Colored-initials avatar. Pass `rank` 1-3 for a gold/silver/bronze ring, `self` for the interactive ring. */
export function Avatar({
  initials,
  rank,
  self = false,
  size = 40,
}: {
  initials: string;
  rank?: number;
  self?: boolean;
  size?: number;
}) {
  const ring =
    rank && RANK_RING[rank]
      ? RANK_RING[rank]
      : self
        ? `linear-gradient(135deg, ${colors.interactive}, ${colors.interactive2})`
        : "transparent";
  return (
    <div
      className="flex shrink-0 items-center justify-center p-[2px]"
      style={{ width: size, height: size, borderRadius: "50%", background: ring }}
    >
      <div
        className="flex h-full w-full items-center justify-center text-[var(--text-primary)]"
        style={{
          borderRadius: "50%",
          background: colors.surfaceCard2,
          fontSize: size * 0.36,
          fontWeight: 800,
        }}
      >
        {initials}
      </div>
    </div>
  );
}

export type StatusTone = "success" | "danger" | "interactive" | "muted" | "gold";

const TONE_STYLES: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: "rgba(79,175,131,0.16)", fg: colors.success },
  danger: { bg: "rgba(216,92,106,0.16)", fg: colors.danger },
  interactive: { bg: "rgba(95,168,211,0.16)", fg: colors.interactive },
  muted: { bg: "rgba(255,255,255,0.06)", fg: colors.textSecondary },
  gold: { bg: "rgba(214,181,110,0.16)", fg: colors.gold },
};

/** Small status pill — used for lock/live/finished states, rank movement, sync health, etc. */
export function Pill({
  children,
  tone = "muted",
  pulse = false,
}: {
  children: ReactNode;
  tone?: StatusTone;
  pulse?: boolean;
}) {
  const { bg, fg } = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold"
      style={{ background: bg, color: fg, borderRadius: "var(--radius-pill)" }}
    >
      {pulse && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"
          style={{ background: fg }}
        />
      )}
      {children}
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const tone: StatusTone = rank === 1 ? "gold" : rank <= 3 ? "interactive" : "muted";
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center text-xs font-extrabold tabular-nums"
      style={{
        borderRadius: "50%",
        background: TONE_STYLES[tone].bg,
        color: TONE_STYLES[tone].fg,
      }}
    >
      {rank}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-muted)]"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      {message}
    </div>
  );
}

export function DataFreshnessNote({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
      <span aria-hidden>⚠️</span>
      {message}
    </p>
  );
}
