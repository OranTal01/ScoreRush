import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { predictMatchScore, type HistoricalResult } from "./auto-model";

const israelDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/** Runs on the morning cron. Never edits an existing personal pick. */
export async function fillAutomaticPredictions(now = new Date()) {
  const day = israelDay(now);
  const nowIso = now.toISOString();
  const fixtures =
    await db.execute(sql`select m.id,m.tournament_id,m.home_team_id,m.away_team_id,m.kickoff,m.lock_time,
    p.participant_id from matches m join participants member on member.tournament_id=m.tournament_id
    join auto_prediction_preferences p on p.participant_id=member.id and p.enabled=true
    left join match_predictions existing on existing.match_id=m.id and existing.participant_id=p.participant_id
    where m.status='scheduled' and m.lock_time>${nowIso}::timestamptz and (m.kickoff at time zone 'Asia/Jerusalem')::date=${day}::date
    and existing.id is null
    order by m.kickoff,m.id`);
  if (!fixtures.length) return { day, filled: 0 };
  const tournaments = [
    ...new Set(fixtures.map((f) => String(f.tournament_id))),
  ];
  let filled = 0;
  for (const tournamentId of tournaments) {
    const [rules] =
      await db.execute(sql`select exact_score_points,winner_and_diff_points,winner_only_points,wrong_points
      from scoring_rules where tournament_id=${tournamentId} order by version desc limit 1`);
    if (!rules) throw new Error(`Scoring rules missing for ${tournamentId}`);
    const past =
      await db.execute(sql`select home_team_id,away_team_id,regular_result,kickoff
      from matches where tournament_id=${tournamentId} and status='finished' and regular_result is not null and kickoff<${nowIso}::timestamptz`);
    const history: HistoricalResult[] = past.map((m) => ({
      homeTeamId: String(m.home_team_id),
      awayTeamId: String(m.away_team_id),
      home: Number((m.regular_result as { home: number }).home),
      away: Number((m.regular_result as { away: number }).away),
      kickoff: new Date(String(m.kickoff)),
    }));
    const scoringRules = {
      exactScorePoints: Number(rules.exact_score_points),
      winnerAndDiffPoints: Number(rules.winner_and_diff_points),
      winnerOnlyPoints: Number(rules.winner_only_points),
      wrongPoints: Number(rules.wrong_points),
    };
    for (const fixture of fixtures.filter(
      (f) => f.tournament_id === tournamentId,
    )) {
      const prediction = predictMatchScore(
        String(fixture.home_team_id),
        String(fixture.away_team_id),
        history,
        scoringRules,
        now,
      );
      const inserted = await db.transaction(async (tx) => {
        const [row] = await tx.execute(sql`insert into match_predictions(match_id,participant_id,predicted_home,predicted_away,is_default)
        select m.id,p.participant_id,${prediction.home},${prediction.away},false
        from matches m join auto_prediction_preferences p on p.participant_id=${String(fixture.participant_id)}::uuid and p.enabled=true
        where m.id=${String(fixture.id)}::uuid and m.status='scheduled' and m.lock_time>now()
        and (m.kickoff at time zone 'Asia/Jerusalem')::date=${day}::date
        on conflict (match_id,participant_id) do nothing returning id`);
        if (!row) return false;
        await tx.execute(sql`insert into system_events(tournament_id,type,payload)
        values(${tournamentId}::uuid,'automatic_prediction',
          jsonb_build_object('participant_id',${String(fixture.participant_id)}::uuid,'match_id',${String(fixture.id)}::uuid,
            'home',${prediction.home}::int,'away',${prediction.away}::int,'model','poisson_form_v1','estimated_points',${prediction.expectedPoints}::numeric))`);
        return true;
      });
      if (inserted) filled++;
    }
  }
  return { day, filled };
}
