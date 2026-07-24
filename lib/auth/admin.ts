/**
 * App-layer mirror of the RLS `public.is_platform_admin` / `is_tournament_admin`
 * Postgres functions (lib/db/migrations/0001_rls_policies.sql), so server
 * components/actions can gate admin UI and redirect *before* attempting a
 * write that RLS would reject, rather than the user discovering "admin
 * only" only after a failed/empty write. RLS remains the real enforcement
 * boundary (ARCHITECTURE.md §13 "RLS-enforced tenant isolation, not just
 * app-layer checks") — this is a UX / defense-in-depth layer on top of it,
 * not a replacement for it.
 *
 * PRODUCT.md §5-6: a platform admin (`users.is_platform_admin`) can act as
 * admin on any tournament; a tournament admin (`participants.role =
 * "tournament_admin"`) only on the tournaments they administer.
 */
import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface AdminContext {
  isPlatformAdmin: boolean;
  isTournamentAdmin: boolean;
  /** isPlatformAdmin || isTournamentAdmin — matches `is_tournament_admin(uid, tid)`'s own definition. */
  isAdmin: boolean;
}

export async function getAdminContext(
  supabase: SupabaseServerClient,
  userId: string,
  tournamentId: string,
): Promise<AdminContext> {
  const [{ data: userRow }, { data: participantRow }] = await Promise.all([
    supabase
      .from("users")
      .select("is_platform_admin")
      .eq("id", userId)
      .maybeSingle<{ is_platform_admin: boolean }>(),
    supabase
      .from("participants")
      .select("role")
      .eq("user_id", userId)
      .eq("tournament_id", tournamentId)
      .maybeSingle<{ role: string }>(),
  ]);

  const isPlatformAdmin = userRow?.is_platform_admin ?? false;
  const isTournamentAdmin = participantRow?.role === "tournament_admin";

  return {
    isPlatformAdmin,
    isTournamentAdmin,
    isAdmin: isPlatformAdmin || isTournamentAdmin,
  };
}

/** Platform-admin-only check, independent of any single tournament — for
 * global actions like tournament creation (DECISIONS.md: "Only the platform
 * owner can create a new tournament in MVP"). */
export async function isPlatformAdmin(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle<{ is_platform_admin: boolean }>();
  return data?.is_platform_admin ?? false;
}
