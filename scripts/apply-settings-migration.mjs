import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import postgres from "postgres";

// Run only after explicit approval for this production schema addition.
// No participant picks, tournament settings values or scores are edited.
const apply = process.argv.includes("--apply");
const expectedHost = "yxnzukupayrhzwnbqibu.supabase.co";
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== expectedHost)
  throw new Error("Unexpected Supabase project; refusing to continue");
const source = await readFile(
  "lib/db/migrations/0010_tournament_settings.sql",
  "utf8",
);
const hash = createHash("sha256").update(source).digest("hex");
const journal = JSON.parse(
  await readFile("lib/db/migrations/meta/_journal.json", "utf8"),
);
const entry = journal.entries.find((x) => x.tag === "0010_tournament_settings");
const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  onnotice: () => {},
});
try {
  const rows =
    await sql`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
  if (rows.length === 11 && rows.at(-1).hash === hash) {
    console.log("Settings migration already applied");
  } else {
    if (rows.length !== 10 || Number(rows.at(-1)?.created_at) !== 1788931000000)
      throw new Error("Unexpected migration history; no changes applied");
    if (!apply)
      console.log(
        "Verified ScoreRush project and 10 existing migrations; settings migration ready for explicit approval",
      );
    else {
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout='5s'`;
        await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
        const [{ n }] =
          await tx`select count(*)::int n from drizzle.__drizzle_migrations`;
        if (n !== 10)
          throw new Error("Migration history changed; retry after inspection");
        for (const statement of source.split("--> statement-breakpoint"))
          if (statement.trim()) await tx.unsafe(statement);
        await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values (${hash},${entry.when})`;
      });
      console.log(
        "Settings migration applied atomically; no tournament or prediction records removed",
      );
    }
  }
} finally {
  await sql.end();
}
