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
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t md:hidden"
      style={{
        height: "var(--spacing-bottom-nav-height, 56px)",
        background: colors.bgElevated,
        borderColor: colors.border,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {primaryNavItems.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors"
            style={{ color: active ? colors.interactive : colors.textMuted }}
          >
            <Icon width={20} height={20} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
