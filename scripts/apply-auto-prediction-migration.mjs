import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import postgres from "postgres";

process.loadEnvFile(".env.local");
if (
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !==
  "yxnzukupayrhzwnbqibu.supabase.co"
)
  throw new Error("Unexpected project");
const url = new URL(process.env.DATABASE_URL);
if (url.hostname.endsWith(".pooler.supabase.com")) url.port = "6543";
const db = postgres(url.toString(), {
  prepare: false,
  max: 1,
  connect_timeout: 15,
});
const source = await readFile(
  "lib/db/migrations/0015_auto_prediction_preferences.sql",
  "utf8",
);
const hash = createHash("sha256").update(source).digest("hex");
try {
  await db.begin(async (tx) => {
    await tx`set local lock_timeout='5s'`;
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const history =
      await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (history.at(-1)?.hash === hash) return console.log("Already applied");
    if (
      history.length !== 15 ||
      Number(history.at(-1)?.created_at) !== 1792101600000
    )
      throw new Error("Unexpected migration history");
    await tx.unsafe(source);
    await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${hash},1793778000000)`;
    console.log("Automatic prediction preference storage created");
  });
} finally {
  await db.end({ timeout: 5 });
}
