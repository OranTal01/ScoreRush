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
  await sql.begin(async (tx) => {
    const [secret] =
      await tx`select count(*)::int as count from vault.secrets where name='scorerush_cron_secret'`;
    if (secret.count !== 1)
      throw new Error("Existing scheduler secret is missing or ambiguous");
    const [runtime] =
      await tx`select access from public.live_runtime where provider='football_data_org'`;
    if (!runtime) throw new Error("Live migration must be installed first");
    if (!process.argv.includes("--apply")) {
      console.log(
        `Ready to schedule live updates; provider access: ${runtime.access}`,
      );
      return;
    }
    await tx`select cron.schedule('scorerush-live-events','* * * * *',${"select net.http_get(url := 'https://scorerush-sigma.vercel.app/api/cron/live', headers := (select jsonb_build_object('Authorization','Bearer ' || decrypted_secret) from vault.decrypted_secrets where name='scorerush_cron_secret'), timeout_milliseconds := 120000) where exists(select 1 from public.live_runtime where provider='football_data_org' and access<>'delayed') and exists(select 1 from public.matches m join public.tournament_providers p on p.tournament_id=m.tournament_id where p.match_data_provider='football_data_org' and m.kickoff between now()-interval '8 hours' and now()+interval '15 minutes' and m.status not in ('postponed','cancelled'));"})`;
    console.log(
      `Conditional live schedule installed; access remains ${runtime.access}. No live calls run while access is delayed. Existing schedules and preferences preserved.`,
    );
  });
} finally {
  await sql.end({ timeout: 5 });
}
