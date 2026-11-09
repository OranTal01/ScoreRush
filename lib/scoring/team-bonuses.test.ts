import {expect,it} from "vitest";
import {deriveTeamBonuses} from "./team-bonuses";
const teams=[{id:"a",providerId:"1",name:"Alpha"},{id:"b",providerId:"2",name:"Beta"}];
it("counts cumulative 120-minute goals and resolves the final winner independently",()=>{
 const result=deriveTeamBonuses([{status:"finished",stage:"final",homeTeamId:"a",awayTeamId:"b",regularResult:{home:1,away:1},extraTimeResult:{home:2,away:2},winner:"away"}],teams);
 expect(result[0].entries.map(e=>e.value)).toEqual([2,2]);
 expect(result.find(s=>s.statKey==="champion")?.entries[0].refId).toBe("2");
});
it("never guesses a champion or awards a zero-goal leader before a finished match",()=>{expect(deriveTeamBonuses([],teams)).toEqual([{statKey:"top_scoring_team",entries:[]}]);});
