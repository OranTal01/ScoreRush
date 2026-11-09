import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
const rollback=Symbol('rollback');
let checks=0;
try {
 await sql.begin(async tx=>{
  for(const file of ['0008_ranking_formats.sql','0009_tournament_onboarding.sql']) {
   const migration=await readFile(`lib/db/migrations/${file}`,'utf8');
   for(const statement of migration.split('--> statement-breakpoint')) if(statement.trim()) await tx.unsafe(statement);
  }
  const [owner]=await tx`select id from users where email='orantal01@gmail.com'`;
  assert(owner);
  const uid=randomUUID();
  await tx`insert into auth.users(id,email,raw_user_meta_data) values(${uid},'scorerush-test@example.invalid','{}'::jsonb)`;
  const [t]=await tx`insert into tournaments(name,competition,created_by,onboarding_open) values('Temporary rollback verification','custom',${owner.id},true) returning id`;
  const [p1]=await tx`insert into participants(tournament_id,user_id,role,display_name) values(${t.id},${owner.id},'tournament_admin','Owner') returning id`;
  const [p2]=await tx`insert into participants(tournament_id,user_id,display_name) values(${t.id},${uid},'Tester') returning id`;
  const [a]=await tx`insert into teams(tournament_id,name,short_name,"group") values(${t.id},'A','A','league') returning id`;
  const [b]=await tx`insert into teams(tournament_id,name,short_name,"group") values(${t.id},'B','B','league') returning id`;
  const [m1]=await tx`insert into matches(tournament_id,home_team_id,away_team_id,stage,"group",matchday,kickoff,lock_time,status,regular_result) values(${t.id},${a.id},${b.id},'league_stage','league',1,now()-interval '1 day',now()-interval '1 day 5 minutes','finished','{"home":2,"away":0}') returning id`;
  const [m2]=await tx`insert into matches(tournament_id,home_team_id,away_team_id,stage,"group",matchday,kickoff,lock_time,status) values(${t.id},${b.id},${a.id},'league_stage','league',2,now()-interval '1 hour',now()-interval '65 minutes','scheduled') returning id`;
  await tx`insert into scoring_rules(tournament_id,ranking_config) values(${t.id},'{"mode":"bands","sizes":[1,1]}')`;
  const [cat]=await tx`insert into bonus_categories(tournament_id,name,type,locks_at) values(${t.id},'Champion','team',now()-interval '1 day') returning id`;
  const [slot]=await tx`insert into bonus_slots(category_id,slot_index,points) values(${cat.id},1,30) returning id`;
  await tx`select public.fill_missing_predictions(${t.id}::uuid)`;
  assert.equal((await tx`select count(*)::int n from match_predictions where match_id=${m1.id}`)[0].n,0); checks++;
  await tx`select set_config('request.jwt.claim.sub',${owner.id},true)`;
  await tx.unsafe('set local role authenticated');
  await tx`insert into match_predictions(match_id,participant_id,predicted_home,predicted_away) values(${m1.id},${p1.id},1,0)`; checks++;
  await tx`insert into bonus_predictions(category_id,slot_id,participant_id,pick_label) values(${cat.id},${slot.id},${p1.id},'A')`; checks++;
  await tx`insert into group_predictions(tournament_id,participant_id,"group",predicted_order) values(${t.id},${p1.id},'league',${tx.json([a.id,b.id])})`; checks++;
  const denied=async fn=>{let blocked=false; try{await tx.savepoint(fn);}catch{blocked=true;} assert(blocked,'Unauthorized write was accepted'); checks++;};
  await denied(async sp=>sp`insert into match_predictions(match_id,participant_id,predicted_home,predicted_away) values(${m2.id},${p1.id},1,0)`);
  await denied(async sp=>sp`insert into match_predictions(match_id,participant_id,predicted_home,predicted_away) values(${m1.id},${p2.id},1,0)`);
  await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
  await denied(async sp=>sp`select public.close_tournament_onboarding(${t.id})`);
  await tx`select set_config('request.jwt.claim.sub',${owner.id},true)`;
  await tx`select public.close_tournament_onboarding(${t.id})`; checks++;
  const [locks]=await tx`select public.is_match_locked(${m1.id}) m, public.is_bonus_category_locked(${cat.id}) b, public.is_group_prediction_locked(${t.id},'league') g`;
  assert(locks.m&&locks.b&&locks.g); checks++;
  await tx.unsafe('reset role');
  await tx`select set_config('request.jwt.claim.sub','',true)`;
  const [def]=await tx`select predicted_home, predicted_away,is_default from match_predictions where match_id=${m1.id} and participant_id=${p2.id}`;
  assert.deepEqual(def,{predicted_home:0,predicted_away:0,is_default:true}); checks++;
  assert.equal((await tx`select count(*)::int n from system_events where tournament_id=${t.id} and type='retrospective_prediction'`)[0].n,1); checks++;
  // Nickname and invite are written in one transaction; none of this test data persists.
  const token=randomUUID();
  await tx`insert into invitations(tournament_id,token,created_by,max_uses) values(${t.id},${token},${owner.id},2)`;
  const uid3=randomUUID();
  await tx`insert into auth.users(id,email,raw_user_meta_data) values(${uid3},'scorerush-join@example.invalid','{}'::jsonb)`;
  await tx`select set_config('request.jwt.claim.sub',${uid3},true)`;
  await tx.unsafe('set local role authenticated');
  const [joined]=await tx`select * from public.consume_invitation_with_nickname(${token},'החלוץ')`;
  assert.equal(joined.display_name,'החלוץ'); checks++;
  throw rollback;
 });
} catch(error) { if(error!==rollback) { console.error(`After ${checks} checks: ${error.message}`);process.exitCode=1; } }
finally{await sql.end();}
if(!process.exitCode) console.log(`${checks} database checks passed; all migration and test writes rolled back.`);
