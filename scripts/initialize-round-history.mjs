import { build } from "esbuild";
import { mkdir, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
if (
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !==
  "yxnzukupayrhzwnbqibu.supabase.co"
)
  throw new Error("Unexpected project");
const folder = resolve("node_modules/.cache/scorerush");
await mkdir(folder, { recursive: true });
const output = resolve(folder, "history-init.cjs");
await build({
  stdin: {
    contents:
      'export {captureRoundHistory} from "./lib/history/capture"; export {db} from "./lib/db/client";',
    resolveDir: process.cwd(),
    sourcefile: "history-init.ts",
  },
  outfile: output,
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [
    {
      name: "server-module",
      setup(b) {
        b.onResolve({ filter: /^server-only$/ }, () => ({
          path: "empty",
          namespace: "empty",
        }));
        b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({
          contents: "",
        }));
      },
    },
  ],
});
try {
  const { db, captureRoundHistory } = createRequire(import.meta.url)(output);
  const tournaments = await db.execute(
    sql`select id from public.tournaments where status <> 'finished' and not exists(select 1 from public.round_history h where h.tournament_id=tournaments.id)`,
  );
  let initialized = 0;
  for (const tournament of tournaments) {
    const result = await captureRoundHistory(tournament.id);
    if (result.captured !== 0)
      throw new Error("Initialization must not fabricate historical captures");
    initialized++;
  }
  const state = await db.execute(
    sql`select count(*)::int as tracked_rounds,count(captured_at)::int as captured_rounds from public.round_history`,
  );
  console.log(
    JSON.stringify({ initializedTournaments: initialized, ...state[0] }),
  );
} finally {
  await unlink(output);
}
