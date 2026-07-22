import { colors } from "@/lib/design-tokens";
import { bracket as content } from "@/lib/content/he";
import { matches } from "@/lib/mock";
import { MatchCard } from "../../_components/match-card";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { EmptyState, SectionHeader } from "../../_components/ui";

/** Screen 12 (UX-BLUEPRINT.md): knockout bracket visualization. This mock
 * tournament only has semifinal + final rounds (8 teams, top 2 per group
 * advance directly) — teams are still TBD until the group stage finishes,
 * which MatchCard's TeamLabel already renders as "טרם נקבע". */
export default function BracketPage() {
  const semifinals = matches.filter((m) => m.stage === "semifinal");
  const final = matches.find((m) => m.stage === "final") ?? null;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[720px]">
      <SubTabs />

      {semifinals.length === 0 && !final ? (
        <EmptyState message={content.tbd} />
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="flex flex-1 flex-col gap-2">
            <SectionHeader title={content.semiFinal} />
            <div className="flex flex-col gap-4 md:h-full md:justify-between">
              {semifinals.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>

          <div
            aria-hidden
            className="hidden h-px w-8 shrink-0 md:block"
            style={{ background: colors.border }}
          />

          {final && (
            <div className="flex flex-1 flex-col gap-2 md:max-w-[300px]">
              <SectionHeader title={content.final} />
              <MatchCard match={final} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
