"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TOURNAMENT_COOKIE } from "@/lib/tournaments/current";

/**
 * Persists the tournament switcher's selection (task #80) as the one
 * cookie `getCurrentParticipant` (lib/tournaments/current.ts) reads before
 * falling back to most-recently-joined — every page under
 * app/(app)/layout.tsx picks this up automatically, with no other call site
 * needing to change. Re-verifies membership server-side rather than
 * trusting the id the client sent, since the switcher's own list could in
 * principle be stale (defense in depth beyond RLS, same rationale as
 * app/(app)/groups/actions.ts).
 *
 * `revalidatePath("/", "layout")` invalidates the shared app-shell layout
 * (isAdmin, the switcher's own list) and every page beneath it, since all of
 * them derive from `getCurrentParticipant`; redirecting to `/` afterward
 * avoids leaving the caller on a page that assumed the previous tournament
 * (e.g. an admin sub-page they're no longer an admin of).
 */
export async function switchTournament(tournamentId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("participants")
    .select("id")
    .eq("user_id", user.id)
    .eq("tournament_id", tournamentId)
    .maybeSingle<{ id: string }>();
  if (!data) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TOURNAMENT_COOKIE, tournamentId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect("/");
}
