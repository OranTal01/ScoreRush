"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, spacing } from "@/lib/design-tokens";
import type { UserTournament } from "@/lib/tournaments/list";
import { primaryNavItems } from "./nav-links";
import { TournamentSwitcher } from "./tournament-switcher";
import { HeaderActions } from "./header-actions";

/** Desktop top bar — UX-BLUEPRINT.md §2: horizontal tabs + inline switcher, hidden on mobile. */
export function TopBar({
  isAdmin,
  tournaments,
  canCreateTournament,
  avatarInitials,
}: {
  isAdmin: boolean;
  tournaments: UserTournament[];
  canCreateTournament: boolean;
  avatarInitials?: string;
}) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-30 hidden items-center justify-between gap-4 border-b px-5 lg:flex xl:px-7"
      style={{
        height: spacing.desktopTopBarHeight,
        background: colors.bgPage,
        borderColor: colors.border,
      }}
    >
      <div className="flex min-w-0 items-center gap-4 xl:gap-8">
        <Link
          href="/"
          aria-label="ScoreRush — דף הבית"
          className="shrink-0 text-lg font-black tracking-tight text-[var(--text-primary)]"
        >
          Score<span className="text-[var(--interactive)]">Rush</span>
        </Link>
        <TournamentSwitcher
          tournaments={tournaments}
          canCreateTournament={canCreateTournament}
        />
      </div>

      <nav aria-label="ניווט ראשי" className="flex items-center gap-1">
        {primaryNavItems.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href) ||
                (href === "/predictions" &&
                  ["/groups", "/bracket"].includes(pathname));
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

      <HeaderActions isAdmin={isAdmin} avatarInitials={avatarInitials} />
    </header>
  );
}
