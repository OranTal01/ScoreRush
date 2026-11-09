import postgres from 'postgres';
const url=new URL(process.env.DATABASE_URL);if(url.hostname.endsWith('.pooler.supabase.com'))url.port='6543';
const db=postgres(url.toString(),{prepare:false,max:1,connect_timeout:15});
try {
 const rows=await db`select t.id,t.name,p.match_data_provider,p.match_data_config->>'competitionCode' as code,p.match_data_config->>'season' as season from tournaments t join tournament_providers p on p.tournament_id=t.id where t.status <> 'finished'`;
 console.log(JSON.stringify({tournaments:rows}));
 for(const code of [...new Set(rows.filter(r=>r.match_data_provider==='football_data_org').map(r=>r.code))]) {
  const response=await fetch(`https://api.football-data.org/v4/competitions/${encodeURIComponent(code)}/matches?season=2026`,{headers:{'X-Auth-Token':process.env.FOOTBALL_DATA_API_TOKEN,'X-Unfold-Goals':'true','X-Unfold-Bookings':'true'},signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  console.log(JSON.stringify({code,status:response.status,availableCalls:response.headers.get('x-requests-available-minute'),count:data.matches?.length,message:data.message,samples:data.matches?.filter(m=>m.status==='FINISHED'||m.status==='IN_PLAY').slice(0,2).map(m=>({id:m.id,status:m.status,minute:m.minute,goalData:Array.isArray(m.goals),goals:m.goals?.length,cardData:Array.isArray(m.bookings),cards:m.bookings?.length,home:m.homeTeam?.name,away:m.awayTeam?.name,updated:m.lastUpdated}))}));
 }
}finally{await db.end({timeout:5});}
