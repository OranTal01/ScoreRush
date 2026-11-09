import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import { formatMatchTime } from "@/lib/time";

export async function RoundReadiness({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !(await getAdminContext(client, user.id, tournamentId)).isAdmin)
    return null;
  // Only completion counts cross the server boundary, never future pick values.
  const upcoming = await db.execute(
    sql`select id, matchday, stage, lock_time from matches where tournament_id=${tournamentId} and status='scheduled' and lock_time>now() order by kickoff`,
  );
  const first = upcoming[0];
  if (!first)
    return (
      <div className="round-progress">
        <h2 className="font-bold">אין כרגע משחקים פתוחים למילוי</h2>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          מצב הקליטה והבחירות המקוריות מופיע בהמשך.
        </p>
      </div>
    );
  const round = upcoming.filter((m) =>
    first.matchday === null
      ? m.stage === first.stage && m.matchday === null
      : m.matchday === first.matchday,
  );
  const ids = sql.join(
    round.map((m) => sql`${m.id}::uuid`),
    sql`, `,
  );
  const rows = await db.execute(
    sql`select p.id,p.display_name,count(mp.id)::int as saved from participants p left join match_predictions mp on mp.participant_id=p.id and mp.is_default=false and mp.match_id in (${ids}) where p.tournament_id=${tournamentId} group by p.id,p.display_name order by count(mp.id),p.display_name`,
  );
  const missing = rows.filter((p) => Number(p.saved) < round.length);
  return (
    <section className="round-progress">
      <p className="eyebrow">
        לקראת {first.matchday ? `מחזור ${first.matchday}` : "המשחקים הקרובים"}
      </p>
      <h2 className="mt-2 text-xl font-extrabold">
        {missing.length
          ? `${missing.length} חברים עדיין צריכים למלא`
          : "כולם מוכנים למחזור ✓"}
      </h2>
      <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
        {rows.length - missing.length} מתוך {rows.length} השלימו את{" "}
        {round.length} המשחקים הפתוחים. נעילה ראשונה:{" "}
        {formatMatchTime(String(first.lock_time))} · שעון ישראל.
      </p>
      {missing.length > 0 && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-[var(--interactive)]">
            מי עדיין לא מוכן? ↓
          </summary>
          <ul className="mt-2 divide-y divide-white/10">
            {missing.map((p) => (
              <li
                key={String(p.id)}
                className="flex justify-between gap-3 py-3 text-sm"
              >
                <bdi className="min-w-0 break-words">
                  {String(p.display_name)}
                </bdi>
                <span className="shrink-0 text-xs text-[var(--gold)]">
                  חסרים {round.length - Number(p.saved)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Link
        href="/admin/notifications"
        className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-[var(--interactive)]"
      >
        מצב התזכורות האוטומטיות ←
      </Link>
    </section>
  );
}
