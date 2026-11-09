import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { EmptyState } from "@/app/_components/ui";
import { SummaryCard } from "@/app/_components/summary-card";
import { readSummaries } from "@/lib/notifications/summaries";
import Link from "next/link";
export default async function SummariesPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const current = user ? await getCurrentParticipant(client, user.id) : null;
  if (!current)
    return <EmptyState message="יש להתחבר לטורניר כדי לראות את הסיכומים." />;
  const [digests, { data: tournament }] = await Promise.all([
    readSummaries(current.tournamentId),
    client
      .from("tournaments")
      .select("name")
      .eq("id", current.tournamentId)
      .single(),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <h1 className="page-heading">הסיכומים של החבר׳ה</h1>
      <p className="page-intro">
        הניקוד, הפגיעות והמהפכים — אחרי שכל משחקי הערב הסתיימו והתוצאות עודכנו.
      </p>
      {!digests.length && (
        <section className="summary-card text-center">
          <span className="text-4xl" aria-hidden>
            🏆
          </span>
          <h2 className="mt-4 text-xl font-extrabold">
            הסיפור הבא עוד נכתב על הדשא
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
            אחרי שכל משחקי הערב יסתיימו והניקוד יאומת, תראו כאן מי הצטיין, מי
            טיפס ואיך השתנתה הטבלה. הסיכומים האוטומטיים מתחילים מהפעלת השירות
            ואילך.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/predictions" className="action-primary">
              מוכנים למחזור הבא? ←
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex min-h-12 items-center px-3 text-sm text-[var(--interactive)]"
            >
              לטבלה הנוכחית
            </Link>
          </div>
        </section>
      )}
      {digests.map((d) => (
        <SummaryCard
          key={d.id}
          data={{
            day: d.day,
            tournamentName: tournament?.name ?? "הטורניר שלנו",
            standings: d.standings ?? [],
            baseline: d.baseline,
          }}
          body={d.body ?? ""}
          selfId={current.participantId}
        />
      ))}
    </div>
  );
}
