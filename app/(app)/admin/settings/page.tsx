import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { tournaments, participants } from "@/lib/db/schema/identity";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext, isPlatformAdmin } from "@/lib/auth/admin";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { readTournamentSettings } from "@/lib/tournaments/settings-store";
import { AdminSubTabs } from "@/app/_components/nav/admin-sub-tabs";
import { Card, EmptyState } from "@/app/_components/ui";
import { SettingsForm } from "./settings-form";
import { OnboardingPanel } from "../_components/onboarding-panel";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/settings");
  const owner = await isPlatformAdmin(supabase, user.id);
  const list = owner
    ? await db
        .select({ id: tournaments.id, name: tournaments.name })
        .from(tournaments)
        .orderBy(asc(tournaments.createdAt))
    : await db
        .select({ id: tournaments.id, name: tournaments.name })
        .from(tournaments)
        .innerJoin(participants, eq(participants.tournamentId, tournaments.id))
        .where(eq(participants.userId, user.id));
  const current = await getCurrentParticipant(supabase, user.id);
  const query = await searchParams;
  const id = query.tournament ?? current?.tournamentId ?? list[0]?.id;
  if (!id) return <EmptyState message="אין עדיין טורנירים לניהול." />;
  if (!list.some((t) => t.id === id))
    return <EmptyState message="הטורניר לא נמצא או שאינו זמין לניהול." />;
  if (
    !z.uuid().safeParse(id).success ||
    !(await getAdminContext(supabase, user.id, id)).isAdmin
  )
    return <EmptyState message="אין לך הרשאת ניהול לטורניר הזה." />;
  const view = await readTournamentSettings(id, owner);
  return (
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-5">
      <AdminSubTabs />
      <div>
        <h1 className="text-2xl font-extrabold">הגדרות הטורניר</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          החוקים שלך, במקום אחד. עריכה רק כשצריך.
        </p>
      </div>
      <Card className="space-y-3">
        <h2 className="text-sm font-bold">בחר טורניר לניהול</h2>
        <div className="flex flex-wrap gap-2">
          {list.map((t) => (
            <Link
              key={t.id}
              aria-current={t.id === id ? "page" : undefined}
              href={`/admin/settings?tournament=${t.id}`}
              className={`max-w-full rounded-xl border px-4 py-3 text-sm break-words ${t.id === id ? "border-[var(--interactive)] bg-[var(--surface-card-2)] text-[var(--interactive)]" : "border-white/15"}`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      </Card>
      <SettingsForm key={id} view={view} />
      <OnboardingPanel tournamentId={id} />
    </div>
  );
}
