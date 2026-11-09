import postgres from 'postgres';
import { readFile, writeFile } from 'node:fs/promises';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const tournamentId = process.argv[2];
if (!tournamentId) throw new Error('Pass a tournament id');
try {
  const teams = await sql`select id, name, provider_id from teams where tournament_id=${tournamentId} and provider_id is not null order by name`;
  const cachePath = `/tmp/scorerush-rosters-${tournamentId}.json`;
  let cache = {};
  try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch {}
  const missingTeams = [];
  const options = new Map();
  for (const [index, team] of teams.entries()) {
    if (index && !cache[team.provider_id]) await new Promise(resolve => setTimeout(resolve, 8000));
    let data = cache[team.provider_id];
    if (!data) {
    const response = await fetch(`https://api.football-data.org/v4/teams/${encodeURIComponent(team.provider_id)}`, {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_TOKEN }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Roster request for ${team.name}: ${response.status}`);
    data = await response.json();
    if (!Array.isArray(data.squad)) throw new Error(`Invalid squad for ${team.name}`);
    cache[team.provider_id] = data;
    await writeFile(cachePath, JSON.stringify(cache));
    }
    if (data.squad.length === 0) { missingTeams.push(team.name); console.log(`Roster unavailable: ${team.name}`); continue; }
    for (const player of data.squad) {
      if (!Number.isInteger(player.id) || typeof player.name !== 'string') throw new Error('Malformed player');
      options.set(String(player.id), { refId: String(player.id), label: player.name, team: team.name });
    }
    console.log(`${index + 1}/${teams.length}: ${team.name} (${data.squad.length})`);
  }
  if (!options.size) throw new Error('No players fetched');
  const playerOptions = [...options.values()].sort((a,b)=>a.label.localeCompare(b.label));
  await sql`update tournament_providers set bonus_stats_config=coalesce(bonus_stats_config,'{}'::jsonb)||${sql.json({playerOptions, playerRosterMissingTeams: missingTeams})} where tournament_id=${tournamentId}`;
  console.log(`Published ${playerOptions.length} validated player options`);
} finally { await sql.end(); }
