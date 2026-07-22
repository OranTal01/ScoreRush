import { bracket, predictions as content } from "@/lib/content/he";
import { matches } from "@/lib/mock";
import type { Match } from "@/lib/mock/types";
import { MatchCard } from "../../_components/match-card";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { EmptyState, SectionHeader } from "../../_components/ui";

function stageLabel(match: Match): string {
  if (match.stage === "semifinal") return bracket.semiFinal;
  if (match.stage === "final") return bracket.final;
  return content.matchdayLabel(match.matchday);
}

/** Matches are already ordered by stage/matchday in the mock fixture, so a
 * single pass groups consecutive matches sharing a label — no re-sort needed. */
function groupByStage(list: Match[]): { label: string; matches: Match[] }[] {
  const sections: { label: string; matches: Match[] }[] = [];
  for (const match of list) {
    const label = stageLabel(match);
    const current = sections[sections.length - 1];
    if (current && current.label === label) {
      current.matches.push(match);
    } else {
      sections.push({ label, matches: [match] });
    }
  }
  return sections;
}

/** Screen 5 (UX-BLUEPRINT.md): all matches for the active tournament, grouped
 * by stage/matchday, with lock-time status per match via the shared MatchCard. */
export default function PredictionsPage() {
  const sections = groupByStage(matches);

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <SubTabs />
      {sections.length === 0 ? (
        <EmptyState message={content.emptyState} />
      ) : (
        sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-2">
            <SectionHeader title={section.label} />
            <div className="flex flex-col gap-2.5">
              {section.matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
