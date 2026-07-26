"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { bracket, groups, predictions } from "@/lib/content/he";

const items = [
  { href: "/predictions", label: predictions.title },
  { href: "/groups", label: groups.title },
  { href: "/bracket", label: bracket.title },
] as const;

/**
 * Tournament-structure sub-navigation (Matches / Groups / Bracket). These
 * three screens are conceptually one area but UX-BLUEPRINT.md's primary nav
 * only has 4 slots (Home/Predictions/Leaderboard/Bonuses), so Groups/Bracket
 * are reached from here rather than crowding the primary tab bar.
 */
export function SubTabs() {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label="ניווט בין מבנה הטורניר"
      className="flex gap-1 border-b p-1"
      style={{ borderColor: colors.border }}
    >
      {items.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className="flex min-h-11 flex-1 items-center justify-center px-3 py-2 text-center text-[13px] font-bold transition-colors"
            style={{
              color: active ? colors.textPrimary : colors.textMuted,
              background: active ? colors.surfaceCard2 : "transparent",
              borderRadius: "var(--radius-button)",
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
