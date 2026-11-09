import postgres from "postgres";

if (
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !==
  "yxnzukupayrhzwnbqibu.supabase.co"
)
  throw new Error("Unexpected project");
const url = new URL(process.env.DATABASE_URL);
if (url.hostname.endsWith(".pooler.supabase.com")) url.port = "6543";
const sql = postgres(url.toString(), {
  prepare: false,
  max: 1,
  connect_timeout: 15,
});
try {
  const result = await sql.begin(async (tx) => {
    await tx`set transaction read only`;
    const upcoming =
      await tx`select id,tournament_id,matchday,stage from matches where status='scheduled' and lock_time>now() order by kickoff limit 1`;
    const first = upcoming[0];
    const readiness = first
      ? await tx`select count(*)::int as participants, count(*) filter(where saved=total)::int as ready from (select p.id,count(mp.id)::int as saved,(select count(*) from matches m where m.tournament_id=${first.tournament_id} and m.status='scheduled' and m.lock_time>now() and (${first.matchday}::integer is not null and m.matchday=${first.matchday} or ${first.matchday}::integer is null and m.stage=${first.stage} and m.matchday is null))::int as total from participants p left join match_predictions mp on mp.participant_id=p.id and mp.is_default=false and mp.match_id in (select id from matches where tournament_id=${first.tournament_id} and status='scheduled' and lock_time>now() and (${first.matchday}::integer is not null and matchday=${first.matchday} or ${first.matchday}::integer is null and stage=${first.stage} and matchday is null)) where p.tournament_id=${first.tournament_id} group by p.id) readiness`
      : [];
    const published =
      await tx`select count(*)::int as count from tournament_digests where published_at is not null`;
    return {
      nextRound: first?.matchday ?? null,
      readiness: readiness[0] ?? null,
      publishedSummaries: published[0].count,
      readOnly: true,
    };
  });
  console.log(JSON.stringify(result));
} finally {
  await sql.end({ timeout: 5 });
}
