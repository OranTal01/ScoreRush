import postgres from "postgres";
import { readFile } from "node:fs/promises";

// Explicitly isolated target: this script never reads .env.local.
const localUrl =
  "postgres://postgres:scorerush-local-only@127.0.0.1:55439/scorerush_settings";
const sql = postgres(localUrl, { prepare: false, max: 1 });
try {
  const [{ n }] =
    await sql`select count(*)::int n from information_schema.tables where table_schema='public'`;
  if (n)
    throw new Error(
      "The local test database is not empty; refusing to overwrite it",
    );
  await sql.unsafe(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text not null, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
  `);
  const journal = JSON.parse(
    await readFile("lib/db/migrations/meta/_journal.json", "utf8"),
  );
  for (const entry of journal.entries) {
    const source = await readFile(`lib/db/migrations/${entry.tag}.sql`, "utf8");
    await sql.begin(async (tx) => {
      for (const statement of source.split("--> statement-breakpoint"))
        if (statement.trim()) await tx.unsafe(statement);
    });
  }
  await sql`insert into auth.users(email) values ('owner@scorerush.test')`;
  await sql`update public.users set is_platform_admin=true where email='owner@scorerush.test'`;
  console.log(
    `Local settings database ready with ${journal.entries.length} migrations and one synthetic test account`,
  );
} finally {
  await sql.end();
}
