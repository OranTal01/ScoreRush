import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const id = '1c06f16c-3c09-4263-8a01-b2785121f12a';
const definitions = [
 ['האלופה','team','champion','tournament_end',[30,20]],
 ['סגנית האלופה','team','runner_up','tournament_end',[20,10]],
 ['הקבוצה המבקיעה ביותר','team','top_scoring_team','tournament_end',[20,10,10]],
 ['מקום ראשון בסיום שלב הליגה','team','league_winner','ongoing',[20,10,10]],
 ['מלך השערים','player','top_scorer','tournament_end',[20,10,10,10]],
 ['מלך הבישולים','player','top_assists','tournament_end',[20,10,10,10]],
];
function decode(value) {
 if(typeof value==='string') return decode(JSON.parse(value));
 if(Array.isArray(value)) return Object.assign({},...value.map(decode));
 return value ?? {};
}
try {
 await sql.begin(async tx=>{
  const [tournament] = await tx`select * from tournaments where id=${id} for update`;
  if(!tournament) throw new Error('Tournament not found');
  if(tournament.onboarding_closed_at) throw new Error('Onboarding was already closed; refusing to reopen');
  if((await tx`select count(*)::int n from bonus_predictions bp join bonus_categories bc on bc.id=bp.category_id where bc.tournament_id=${id}`)[0].n ||
     (await tx`select count(*)::int n from group_predictions where tournament_id=${id}`)[0].n) throw new Error('Predictions exist; rules need a deliberate revision');
  const [provider] = await tx`select * from tournament_providers where tournament_id=${id}`;
  const config = decode(provider.bonus_stats_config);
  const bindings = {};
  await tx`insert into system_events(tournament_id,type,payload) values(${id},'launch_configuration_updated',${tx.json({previousMatchConfig:provider.match_data_config,previousBonusConfig:provider.bonus_stats_config,reason:'Owner-approved UCL rules and WhatsApp onboarding'})})`;
  for(const [sortOrder,[name,type,statKey,resolves,points]] of definitions.entries()) {
   let [category] = await tx`select id from bonus_categories where tournament_id=${id} and name=${name}`;
   if(!category) [category] = await tx`insert into bonus_categories(tournament_id,name,type,resolves_at,duplicate_stacking_allowed,locks_at,sort_order) values(${id},${name},${type},${resolves},true,'2026-09-08T16:45:00Z',${sortOrder}) returning id`;
   await tx`update bonus_categories set resolves_at=${resolves},sort_order=${sortOrder},duplicate_stacking_allowed=true where id=${category.id}`;
   // This prelaunch script is only allowed while no bonus predictions exist.
   await tx`delete from bonus_slots where category_id=${category.id}`;
   await tx`insert into bonus_slots ${tx(points.map((value,index)=>({category_id:category.id,slot_index:index+1,points:value})))}`;
   bindings[category.id]=statKey;
  }
  await tx`update scoring_rules set exact_score_points=9,winner_and_diff_points=6,winner_only_points=3,wrong_points=0,group_ranking_points_per_position=3,ranking_config=${tx.json({mode:'bands',sizes:[8,16,12]})} where tournament_id=${id}`;
  await tx`update tournament_providers set match_data_config=${tx.json({competitionCode:'CL',season:2026})},bonus_stats_config=${tx.json({...config,competitionCode:'CL',season:2026,categoryStatKeys:bindings,assistsCoverageVerified:false})} where tournament_id=${id}`;
  await tx`update tournaments set onboarding_open=true,onboarding_matchday=1,status='active' where id=${id}`;
  await tx`update match_predictions mp set is_default=true from matches m where mp.match_id=m.id and m.tournament_id=${id} and mp.predicted_home=0 and mp.predicted_away=0 and mp.submitted_at=m.lock_time and mp.edited_at is null`;
  await tx`update invitations set expires_at=null,status=case when use_count>=max_uses then 'consumed'::invitation_status else 'pending'::invitation_status end where tournament_id=${id} and status in ('pending','expired')`;
  await tx`select cron.alter_job(job_id:=jobid,command:='select public.fill_missing_predictions();') from cron.job where jobname='scorerush-default-predictions'`;
 });
 console.log(await sql`select name,onboarding_open from tournaments where id=${id}`);
 console.log(await sql`select jsonb_typeof(match_data_config) match_config_type,jsonb_typeof(bonus_stats_config) bonus_config_type,jsonb_array_length(bonus_stats_config->'playerOptions') player_choices from tournament_providers where tournament_id=${id}`);
 console.log(await sql`select c.name,array_agg(s.points order by s.slot_index) points from bonus_categories c join bonus_slots s on s.category_id=c.id where c.tournament_id=${id} group by c.id order by c.sort_order`);
 console.log(await sql`select 'https://scorerush-sigma.vercel.app/join/'||token as join_url from invitations where tournament_id=${id} and status='pending' order by created_at desc limit 1`);
} finally { await sql.end(); }
