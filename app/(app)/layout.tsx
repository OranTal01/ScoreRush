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
import { SaveFeedbackProvider } from "../_components/save-feedback";

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
  let avatarInitials = "?";

  if (user) {
    const current = await getCurrentParticipant(supabase, user.id);
    if (current) {
      const { data: profile } = await supabase
        .from("participants")
        .select("avatar_initials, display_name")
        .eq("id", current.participantId)
        .maybeSingle();
      avatarInitials =
        profile?.avatar_initials ||
        profile?.display_name?.trim().slice(0, 2) ||
        "?";
    }
    [isAdmin, canCreateTournament, tournaments] = await Promise.all([
      resolveIsAdmin(supabase, user.id, current),
      isPlatformAdmin(supabase, user.id),
      getUserTournaments(supabase, user.id, current?.tournamentId ?? null),
    ]);
  }

  return (
    <SaveFeedbackProvider>
      <a href="#main-content" className="skip-link action-primary">
        דילוג לתוכן
      </a>
      <MobileHeader
        isAdmin={isAdmin}
        tournaments={tournaments}
        canCreateTournament={canCreateTournament}
        avatarInitials={avatarInitials}
      />
      <TopBar
        isAdmin={isAdmin}
        tournaments={tournaments}
        canCreateTournament={canCreateTournament}
        avatarInitials={avatarInitials}
      />
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1320px] min-w-0 px-4 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 lg:px-7 lg:pt-7 lg:pb-12"
      >
        {children}
      </main>
      <BottomNav />
    </SaveFeedbackProvider>
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
