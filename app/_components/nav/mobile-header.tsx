import { colors } from "@/lib/design-tokens";
import { TournamentSwitcher } from "./tournament-switcher";
import { HeaderActions } from "./header-actions";

/** Mobile header — tournament switcher lives here, not the bottom nav (UX-BLUEPRINT.md §2). */
export function MobileHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b px-4 md:hidden"
      style={{
        background: colors.bgPage,
        borderColor: colors.border,
        paddingTop: "max(env(safe-area-inset-top), 14px)",
        paddingBottom: "10px",
      }}
    >
      <TournamentSwitcher />
      <HeaderActions isAdmin={isAdmin} />
    </header>
  );
}
