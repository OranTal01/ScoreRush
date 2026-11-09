import { rankByValue } from "@/lib/providers/normalize";
import type { CanonicalBonusStatResult } from "@/lib/providers/types";
type Team = {id:string;providerId:string|null;name:string};
type Match = {status:string;stage:string;homeTeamId:string;awayTeamId:string;regularResult:{home:number;away:number}|null;extraTimeResult:{home:number;away:number}|null;winner:string|null};
export function deriveTeamBonuses(matches: readonly Match[], teams:readonly Team[]):CanonicalBonusStatResult[] {
 const goals=new Map<string,number>();
 for(const match of matches){if(match.status!=="finished"||!match.regularResult)continue;
   const score=match.extraTimeResult??match.regularResult;
   goals.set(match.homeTeamId,(goals.get(match.homeTeamId)??0)+score.home);
   goals.set(match.awayTeamId,(goals.get(match.awayTeamId)??0)+score.away);
 }
 const output:CanonicalBonusStatResult[]=[{statKey:"top_scoring_team",entries:rankByValue(teams.filter(team=>(goals.get(team.id)??0)>0).map(team=>({refId:team.providerId,label:team.name,value:goals.get(team.id)??0})))}];
 const final=matches.find(match=>match.stage==="final"&&match.status==="finished"&&(match.winner==="home"||match.winner==="away"));
 if(final){for(const [key,id] of [["champion",final.winner==="home"?final.homeTeamId:final.awayTeamId],["runner_up",final.winner==="home"?final.awayTeamId:final.homeTeamId]]){
   const team=teams.find(t=>t.id===id);if(team)output.push({statKey:key,entries:[{refId:team.providerId,label:team.name,value:1,rank:1}]});
 }}
 return output;
}
