"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, spacing } from "@/lib/design-tokens";
import { primaryNavItems } from "./nav-links";
import { TournamentSwitcher } from "./tournament-switcher";
import { HeaderActions } from "./header-actions";

/** Desktop top bar — UX-BLUEPRINT.md §2: horizontal tabs + inline switcher, hidden on mobile. */
export function TopBar() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-30 hidden items-center justify-between border-b px-7 md:flex"
      style={{
        height: spacing.desktopTopBarHeight,
        background: colors.bgPage,
        borderColor: colors.border,
      }}
    >
      <div className="flex items-center gap-8">
        <span className="text-lg font-black text-[var(--text-primary)]">
          ScoreRush
        </span>
        <TournamentSwitcher />
      </div>

      <nav aria-label="ניווט ראשי" className="flex items-center gap-1">
        {primaryNavItems.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold transition-colors"
              style={{
                color: active ? colors.textPrimary : colors.textSecondary,
                background: active ? colors.surfaceCard2 : "transparent",
                borderRadius: "var(--radius-button)",
              }}
            >
              <Icon width={17} height={17} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <HeaderActions />
    </header>
  );
}
