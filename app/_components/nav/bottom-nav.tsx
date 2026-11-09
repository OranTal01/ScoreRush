"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { primaryNavItems } from "./nav-links";

/** Fixed mobile bottom nav — UX-BLUEPRINT.md §2, hidden at desktop breakpoint. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t lg:hidden"
      style={{
        height: "calc(64px + env(safe-area-inset-bottom))",
        background: colors.bgElevated,
        borderColor: colors.border,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
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
            className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors"
            style={{ color: active ? colors.interactive : colors.textMuted }}
          >
            {active && (
              <span
                aria-hidden
                className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--interactive)]"
              />
            )}
            <Icon width={20} height={20} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
