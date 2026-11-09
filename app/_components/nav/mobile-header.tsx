import { colors } from "@/lib/design-tokens";
import type { UserTournament } from "@/lib/tournaments/list";
import { TournamentSwitcher } from "./tournament-switcher";
import { HeaderActions } from "./header-actions";

/** Mobile header — tournament switcher lives here, not the bottom nav (UX-BLUEPRINT.md §2). */
export function MobileHeader({
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
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b px-4 lg:hidden"
      style={{
        background: colors.bgPage,
        borderColor: colors.border,
        paddingTop: "max(env(safe-area-inset-top), 14px)",
        paddingBottom: "10px",
      }}
    >
      <TournamentSwitcher
        tournaments={tournaments}
        canCreateTournament={canCreateTournament}
      />
      <HeaderActions isAdmin={isAdmin} avatarInitials={avatarInitials} />
    </header>
  );
}
