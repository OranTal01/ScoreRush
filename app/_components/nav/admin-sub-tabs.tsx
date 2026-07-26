"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import {
  admin,
  auditLog,
  diagnostics,
  notificationCenter,
  participantsAdmin,
} from "@/lib/content/he";

const items = [
  { href: "/admin", label: admin.overviewTitle },
  { href: "/admin/participants", label: participantsAdmin.title },
  { href: "/admin/diagnostics", label: diagnostics.title },
  { href: "/admin/notifications", label: notificationCenter.title },
  { href: "/admin/audit", label: auditLog.title },
] as const;

/**
 * Admin section sub-navigation (Phase 7 task #63), same tablist pattern as
 * app/_components/nav/sub-tabs.tsx's Predictions/Groups/Bracket tabs — one
 * shared component rendered at the top of every top-level admin screen so
 * an admin can jump between sections without going back through the
 * overview page each time. Previously each screen only linked to the ones
 * it happened to lead into (e.g. overview -> participants/diagnostics/audit
 * as ad-hoc header links); this replaces that scattered, inconsistent set
 * with one nav that's identical everywhere.
 *
 * Deliberately lists only the four top-level admin screens. Drill-down
 * detail pages (admin/diagnostics/[matchId], admin/overrides/[matchId]) are
 * reached via their own contextual back-links instead — same as how match
 * detail pages never render SubTabs either, only the top-level Predictions
 * list does. Tournament creation is a platform-owner-only one-off action
 * (its own CTA on the overview page), not a persistent section an admin
 * revisits, so it's excluded here too.
 */
export function AdminSubTabs() {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label="ניווט בין מסכי הניהול"
      className="flex gap-1 overflow-x-auto border-b p-1"
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
            className="flex-1 whitespace-nowrap px-3 py-2 text-center text-[13px] font-bold transition-colors"
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
