import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  onnotice: () => {},
});
const source = await readFile(
  "lib/db/migrations/0011_push_notifications.sql",
  "utf8",
);
const hash = createHash("sha256").update(source).digest("hex");
try {
  await sql.begin(async (tx) => {
    await tx`set local lock_timeout='5s'`;
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows =
      await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (rows.at(-1)?.hash === hash) {
      console.log("Push migration already applied");
      return;
    }
    if (rows.length !== 11 || Number(rows.at(-1)?.created_at) !== 1788983500000)
      throw new Error("Unexpected migration history");
    if (!process.argv.includes("--apply")) {
      console.log(
        "Verified target and history; only four new notification tables will be added",
      );
      return;
    }
    await tx.unsafe(source);
    await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${hash},1789129800000)`;
    console.log(
      "Push tables created; runtime remains disabled until deployment verification",
    );
  });
} finally {
  await sql.end({ timeout: 5 });
}
