import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
const sql=postgres(process.env.DATABASE_URL,{prepare:false,connect_timeout:15,onnotice:()=>{}});
try {
 const response=await fetch('https://api.football-data.org/v4/competitions/CL/matches?season=2026',{headers:{'X-Auth-Token':process.env.FOOTBALL_DATA_API_TOKEN},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`Fixtures ${response.status}`);
 const payload=await response.json(), games=payload.matches;
 if(!Array.isArray(games)||games.length!==144||games.some(m=>m.stage!=='LEAGUE_STAGE'||!['TIMED','SCHEDULED'].includes(m.status)))throw new Error('Unexpected league fixtures; inspect before creating');
 const firstKickoff=new Date(Math.min(...games.map(m=>Date.parse(m.utcDate))));
 if(firstKickoff.getTime()<=Date.now())throw new Error('Tournament already started');
 await sql.begin(async tx=>{
   const [owner]=await tx`select id,display_name from users where lower(email)='orantal01@gmail.com' and is_platform_admin=true`;
   if(!owner)throw new Error('Expected owner missing');
   const existing=await tx`select id from tournaments where competition='champions_league' and name='ליגת האלופות 2026/27 · החברים'`;
   if(existing.length){console.log('Tournament already exists',existing[0].id);return;}
   const [t]=await tx`insert into tournaments(name,competition,created_by) values('ליגת האלופות 2026/27 · החברים','champions_league',${owner.id}) returning id`;
   await tx`insert into participants(tournament_id,user_id,role,display_name,avatar_initials) values(${t.id},${owner.id},'tournament_admin',${owner.display_name},'OT')`;
   await tx`insert into scoring_rules(tournament_id,exact_score_points,winner_and_diff_points,winner_only_points,wrong_points,group_ranking_points_per_position) values(${t.id},9,6,3,0,3)`;
   const roster=new Map();for(const game of games)for(const team of [game.homeTeam,game.awayTeam])roster.set(team.id,team);
   if(roster.size!==36)throw new Error('Expected 36 teams');
   const teamRows=[...roster.values()].map(team=>({id:randomUUID(),tournament_id:t.id,name:team.name,short_name:team.shortName||team.name,provider_id:String(team.id),group:'league',flag_asset_url:team.crest??null}));
   await tx`insert into teams ${tx(teamRows)}`;
   const ids=new Map(teamRows.map(team=>[team.provider_id,team.id]));
   const gameRows=games.map(game=>({tournament_id:t.id,provider_id:String(game.id),stage:'league_stage',group:'league',matchday:game.matchday,home_team_id:ids.get(String(game.homeTeam.id)),away_team_id:ids.get(String(game.awayTeam.id)),kickoff:game.utcDate,lock_time:new Date(Date.parse(game.utcDate)-300000).toISOString(),status:'scheduled',raw_provider_payload:JSON.stringify(game),last_synced_at:new Date().toISOString(),normalization_status:'normalized'}));
   await tx`insert into matches ${tx(gameRows)}`;
   const categories=[['מלך השערים','player','ongoing','top_scorer'],['מלך הבישולים','player','ongoing','top_assists'],['הקבוצה המבקיעה ביותר','team','ongoing','top_scoring_team'],['האלופה','team','tournament_end','champion'],['סגנית האלופה','team','tournament_end','runner_up']];
   const categoryStatKeys={};
   for(const [index,[name,type,resolves,key]] of categories.entries()){
     const [category]=await tx`insert into bonus_categories(tournament_id,name,type,resolves_at,locks_at,sort_order) values(${t.id},${name},${type},${resolves},${firstKickoff.toISOString()},${index}) returning id`;
     categoryStatKeys[category.id]=key;
     await tx`insert into bonus_slots ${tx([20,10,10].map((points,i)=>({category_id:category.id,slot_index:i+1,points})))}`;
   }
   await tx`insert into tournament_providers(tournament_id,match_data_provider,match_data_config,bonus_stats_provider,bonus_stats_config) values(${t.id},'football_data_org',${JSON.stringify({competitionCode:'CL',season:2026})}::jsonb,'football_data_org',${JSON.stringify({competitionCode:'CL',season:2026,limit:500,categoryStatKeys,assistsCoverageVerified:false})}::jsonb)`;
   const token=randomUUID();
   await tx`insert into invitations(tournament_id,token,created_by,expires_at,max_uses) values(${t.id},${token},${owner.id},${firstKickoff.toISOString()},23)`;
   await tx`insert into system_events(tournament_id,type,payload) values(${t.id},'tournament_created',${JSON.stringify({createdBy:owner.id,name:'ליגת האלופות 2026/27 · החברים',season:2026,matchCount:144,lockMinutesBeforeKickoff:5,missingPrediction:{home:0,away:0},firstKickoff:firstKickoff.toISOString(),invitationCapacity:23,bonusAssists:'manual verification required'})}::jsonb)`;
   console.log(JSON.stringify({tournamentId:t.id,matches:144,teams:36,bonusCategories:5,firstKickoff:firstKickoff.toISOString(),firstLock:new Date(firstKickoff-300000).toISOString(),joinUrl:`https://scorerush-sigma.vercel.app/join/${token}`}));
 });
}finally{await sql.end()}
