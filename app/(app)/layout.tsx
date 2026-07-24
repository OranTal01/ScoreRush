import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { MobileHeader } from "../_components/nav/mobile-header";
import { TopBar } from "../_components/nav/top-bar";
import { BottomNav } from "../_components/nav/bottom-nav";

/**
 * Shared chrome for every participant/admin screen — UX-BLUEPRINT.md §2
 * navigation model. Mobile gets a sticky header + fixed bottom nav; desktop
 * gets a single top bar. Route-group layout, so it doesn't affect the URL.
 *
 * Computes the real `isAdmin` flag once here (lib/auth/admin.ts, Phase 7
 * task #57) and threads it down to the header components as a plain prop —
 * TopBar is a client component ("use client", for usePathname), so it can't
 * import and render a server component that does its own data fetching, but
 * a boolean prop computed by this server layout is fine. `proxy.ts` already
 * redirects signed-out visitors to /login before they ever reach this
 * layout, but `resolveIsAdmin` still degrades to `false` rather than
 * throwing if that assumption ever changes.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await resolveIsAdmin();

  return (
    <>
      <MobileHeader isAdmin={isAdmin} />
      <TopBar isAdmin={isAdmin} />
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

/** Resolves the caller's admin status for their current tournament, or
 * `false` for a signed-out visitor or a user with no tournament yet — never
 * throws, since this runs on every page in the app shell including public
 * ones. */
async function resolveIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) return false;

  const { isAdmin } = await getAdminContext(
    supabase,
    user.id,
    current.tournamentId,
  );
  return isAdmin;
}
