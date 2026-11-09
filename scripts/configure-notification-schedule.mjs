import postgres from "postgres";
if (
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !==
  "yxnzukupayrhzwnbqibu.supabase.co"
)
  throw new Error("Unexpected project");
if (!process.env.CRON_SECRET) throw new Error("Missing cron secret");
const url = new URL(process.env.DATABASE_URL);
if (url.hostname.endsWith(".pooler.supabase.com")) url.port = "6543";
const sql = postgres(url.toString(), {
  prepare: false,
  max: 1,
  connect_timeout: 15,
});
try {
  if (!process.argv.includes("--apply")) {
    console.log(
      "Ready: reminder scan every 5 minutes; sync every 15 minutes only around matches. Uses existing Supabase extensions.",
    );
  } else
    await sql.begin(async (tx) => {
      const [old] =
        await tx`select id from vault.secrets where name='scorerush_cron_secret'`;
      if (old)
        await tx`select vault.update_secret(${old.id},${process.env.CRON_SECRET})`;
      else
        await tx`select vault.create_secret(${process.env.CRON_SECRET},'scorerush_cron_secret','ScoreRush authenticated scheduler')`;
      await tx`select cron.schedule('scorerush-notifications','*/5 * * * *',${"select net.http_get(url := 'https://scorerush-sigma.vercel.app/api/cron/notifications', headers := (select jsonb_build_object('Authorization','Bearer ' || decrypted_secret) from vault.decrypted_secrets where name='scorerush_cron_secret'), timeout_milliseconds := 280000);"})`;
      await tx`select cron.schedule('scorerush-live-sync','*/15 * * * *',${"select net.http_get(url := 'https://scorerush-sigma.vercel.app/api/cron/sync', headers := (select jsonb_build_object('Authorization','Bearer ' || decrypted_secret) from vault.decrypted_secrets where name='scorerush_cron_secret'), timeout_milliseconds := 280000) where exists(select 1 from public.matches where kickoff between now()-interval '8 hours' and now()+interval '15 minutes' and status not in ('postponed','cancelled'));"})`;
      await tx`update public.notification_runtime set enabled=true, enabled_at=now(), last_run_at=null where id='push'`;
      console.log(
        "Notification scheduler enabled; no retrospective notifications and no WhatsApp sending configured",
      );
    });
} finally {
  await sql.end({ timeout: 5 });
}
