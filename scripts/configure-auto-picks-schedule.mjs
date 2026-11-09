import postgres from "postgres";

process.loadEnvFile(".env.local");
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "yxnzukupayrhzwnbqibu.supabase.co")
  throw new Error("Unexpected project");
const url = new URL(process.env.DATABASE_URL);
if (url.hostname.endsWith(".pooler.supabase.com")) url.port = "6543";
const db = postgres(url.toString(), { prepare: false, max: 1, connect_timeout: 15 });
const command = `select net.http_get(
  url := 'https://scorerush-sigma.vercel.app/api/cron/auto-picks',
  headers := (select jsonb_build_object('Authorization','Bearer ' || decrypted_secret)
              from vault.decrypted_secrets where name='scorerush_cron_secret'),
  timeout_milliseconds := 55000
) where exists (
  select 1 from matches m join participants p on p.tournament_id=m.tournament_id
    join auto_prediction_preferences a on a.participant_id=p.id and a.enabled
  where m.status='scheduled' and m.lock_time>now()
    and (m.kickoff at time zone 'Asia/Jerusalem')::date=(now() at time zone 'Asia/Jerusalem')::date
);`;
try {
  await db.begin(async (tx) => {
    const [secret] = await tx`select name from vault.decrypted_secrets where name='scorerush_cron_secret'`;
    if (!secret) throw new Error("Scheduler secret missing");
    await tx`select cron.schedule('scorerush-auto-picks-morning','10 6 * * *',${command})`;
    await tx`select cron.schedule('scorerush-auto-picks-backup','10 13 * * *',${command})`;
    const jobs = await tx`select jobname,schedule,active from cron.job where jobname in ('scorerush-auto-picks-morning','scorerush-auto-picks-backup') order by jobname`;
    if (jobs.length !== 2 || jobs.some((j) => !j.active))
      throw new Error("Automatic pick jobs were not enabled");
    console.log(JSON.stringify(jobs));
  });
} finally {
  await db.end({ timeout: 5 });
}
