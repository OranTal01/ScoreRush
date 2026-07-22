import { leaderboard as content } from "@/lib/content/he";
import { currentParticipant, participants } from "@/lib/mock";
import { Podium } from "../../_components/leaderboard/podium";
import { RankRow } from "../../_components/leaderboard/rank-row";
import { Card, EmptyState, SectionHeader } from "../../_components/ui";

/** Screen 8 (UX-BLUEPRINT.md): full ranked list + podium, own-row highlight,
 * rank movement indicators. */
export default function LeaderboardPage() {
  const sorted = [...participants].sort((a, b) => a.rank - b.rank);
  const topThree = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  if (sorted.length === 0) {
    return <EmptyState message={content.emptyState} />;
  }

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <Card className="flex flex-col gap-4">
        <SectionHeader title={content.podiumTitle} />
        <Podium topThree={topThree} selfId={currentParticipant.id} />
      </Card>

      <Card className="flex flex-col gap-1">
        <SectionHeader title={content.title} />
        <ol className="flex flex-col gap-1">
          {rest.map((participant, index) => (
            <RankRow
              key={participant.id}
              participant={participant}
              selfId={currentParticipant.id}
              index={index}
            />
          ))}
        </ol>
      </Card>
    </div>
  );
}
