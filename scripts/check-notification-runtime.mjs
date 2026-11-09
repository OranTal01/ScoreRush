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
  const [runtime, subscriptions, jobs] = await Promise.all([
    sql`select enabled, enabled_at, last_run_at from public.notification_runtime where id='push'`,
    sql`select count(*)::int as count from public.push_subscriptions`,
    sql`select jobname, schedule, active from cron.job where jobname in ('scorerush-notifications','scorerush-live-sync') order by jobname`,
  ]);
  console.log(
    JSON.stringify({
      runtime,
      subscriptions: subscriptions[0].count,
      jobs,
    }),
  );
} finally {
  await sql.end({ timeout: 5 });
}
