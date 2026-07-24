import Link from "next/link";
import { colors } from "@/lib/design-tokens";
import { currentParticipant } from "@/lib/mock";
import { Avatar } from "../ui";
import { IconAdmin } from "../icons";

/**
 * Profile avatar + admin entry point (admins only) — shared by mobile header
 * and desktop top bar. `isAdmin` is now the real value, computed server-side
 * in app/(app)/layout.tsx via lib/auth/admin.ts (Phase 7 task #57) and
 * threaded down as a prop; hiding this link was never real access control
 * (the admin page itself now enforces its own guard) but it should still
 * reflect reality rather than mock data. `avatarInitials` is still Phase-2
 * mock — wiring the header to the caller's real profile is a separate,
 * unrelated gap (no admin-tooling scope here).
 */
export function HeaderActions({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {isAdmin && (
        <Link
          href="/admin"
          aria-label="ניהול טורניר"
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            background: colors.surfaceCard2,
            color: colors.textSecondary,
          }}
        >
          <IconAdmin width={17} height={17} aria-hidden />
        </Link>
      )}
      <Link href="/profile" aria-label="פרופיל">
        <Avatar initials={currentParticipant.avatarInitials} self size={32} />
      </Link>
    </div>
  );
}
