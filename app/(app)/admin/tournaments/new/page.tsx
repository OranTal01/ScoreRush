import { createTournament as content } from "@/lib/content/he";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/app/_components/ui";
import { CreateTournamentForm } from "./_components/create-tournament-form";

/**
 * Tournament creation flow (ROADMAP.md Phase 7 task #58, UX-BLUEPRINT.md §5
 * flow F "Create tournament -> choose competition type -> bind provider (or
 * manual mode) -> configure scoring/bonus/prize rules"). Platform-owner-only
 * (DECISIONS.md "Tournament creation") — deliberately does NOT require an
 * existing `getCurrentParticipant` row like the rest of the app shell does,
 * since this is exactly the screen a platform owner with zero tournaments
 * yet (the very first bootstrap case) needs to reach.
 */
export default async function CreateTournamentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <EmptyState message={content.errorUnauthenticated} />;
  }

  if (!(await isPlatformAdmin(supabase, user.id))) {
    return <EmptyState message={content.errorNotPlatformAdmin} />;
  }

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
        {content.title}
      </h1>
      <CreateTournamentForm />
    </div>
  );
}
