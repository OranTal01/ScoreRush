import { getAdminContext, isPlatformAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentParticipant,
  type CurrentParticipant,
} from "@/lib/tournaments/current";
import {
  getUserTournaments,
  type UserTournament,
} from "@/lib/tournaments/list";
import { MobileHeader } from "../_components/nav/mobile-header";
import { TopBar } from "../_components/nav/top-bar";
import { BottomNav } from "../_components/nav/bottom-nav";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Shared chrome for every participant/admin screen — UX-BLUEPRINT.md §2
 * navigation model. Mobile gets a sticky header + fixed bottom nav; desktop
 * gets a single top bar. Route-group layout, so it doesn't affect the URL.
 *
 * Computes the real `isAdmin` flag and the caller's real tournament list
 * once here (lib/auth/admin.ts Phase 7 task #57; lib/tournaments/list.ts
 * task #80) and threads both down to the header components as plain props —
 * TopBar is a client component ("use client", for usePathname), so it can't
 * import and render a server component that does its own data fetching, but
 * props computed by this server layout are fine. `proxy.ts` already
 * redirects signed-out visitors to /login before they ever reach this
 * layout, but this still degrades to `isAdmin: false, tournaments: []`
 * rather than throwing if that assumption ever changes.
 *
 * `canCreateTournament` is computed separately from `isAdmin` — it's the
 * platform-admin check specifically (DECISIONS.md: "Only the platform owner
 * can create a new tournament in MVP"), not the broader tournament-scoped
 * `isAdmin` (isTournamentAdmin || isPlatformAdmin) HeaderActions uses for the
 * admin nav entry. Reusing `isAdmin` here would show a tournament_admin
 * who isn't the platform owner a "create tournament" entry that fails with
 * `not_platform_admin` after they fill out the whole form.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let canCreateTournament = false;
  let tournaments: UserTournament[] = [];

  if (user) {
    const current = await getCurrentParticipant(supabase, user.id);
    [isAdmin, canCreateTournament, tournaments] = await Promise.all([
      resolveIsAdmin(supabase, user.id, current),
      isPlatformAdmin(supabase, user.id),
      getUserTournaments(supabase, user.id, current?.tournamentId ?? null),
    ]);
  }

  return (
    <>
      <MobileHeader
        isAdmin={isAdmin}
        tournaments={tournaments}
        canCreateTournament={canCreateTournament}
      />
      <TopBar
        isAdmin={isAdmin}
        tournaments={tournaments}
        canCreateTournament={canCreateTournament}
      />
      <main
        className="mx-auto w-full px-4 md:max-w-[var(--spacing-desktop-max-width,1320px)] md:px-7 md:py-6"
        style={{
          paddingBottom: "var(--spacing-page-padding-bottom, 90px)",
          paddingTop: 16,
        }}
      >
        {children}
      </main>
      <BottomNav />
    </>
  );
}

/** Resolves the caller's admin status for their current tournament.
 *
 * A user with no tournament yet still counts as admin if they're the
 * platform owner: tournament creation (Phase 7 task #58,
 * app/(app)/admin/tournaments/new) is a global capability that doesn't
 * require existing membership, and is exactly what a platform owner with
 * zero tournaments needs to reach — hiding the header admin entry point in
 * that bootstrap case would make it undiscoverable. */
async function resolveIsAdmin(
  supabase: SupabaseServerClient,
  userId: string,
  current: CurrentParticipant | null,
): Promise<boolean> {
  if (!current) return isPlatformAdmin(supabase, userId);

  const { isAdmin } = await getAdminContext(
    supabase,
    userId,
    current.tournamentId,
  );
  return isAdmin;
}
