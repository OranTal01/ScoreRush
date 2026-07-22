import { colors, gradients } from "@/lib/design-tokens";
import { common, profile as content, scoring, tournamentSwitcher } from "@/lib/content/he";
import { currentParticipant, otherTournaments, tournament } from "@/lib/mock";
import { Avatar, Card, Pill, SectionHeader } from "../../_components/ui";

/** Screen 9/16 combined for Phase 2 (UX-BLUEPRINT.md): public-facing profile
 * — rank history, achievements, streaks, prediction accuracy — plus the
 * account-level linked-tournaments list. */
export default function ProfilePage() {
  const rankMoved = currentParticipant.previousRank - currentParticipant.rank;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[480px]">
      <Card padding="hero" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: gradients.hero }}
        />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <Avatar initials={currentParticipant.avatarInitials} self size={72} />
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-extrabold text-[var(--text-primary)]">
              {currentParticipant.displayName}
            </span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {currentParticipant.role === "tournament_admin"
                ? content.roleAdmin
                : content.roleParticipant}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-0.5">
              <span className="ltr text-2xl font-black tabular-nums text-[var(--gold)]">
                {currentParticipant.totalPoints}
              </span>
              <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                {common.points}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="ltr text-2xl font-black tabular-nums text-[var(--text-primary)]">
                {currentParticipant.rank}
              </span>
              <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                {common.rank}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="px-4 py-2 text-xs font-bold text-[var(--text-primary)]"
            style={{ background: colors.surfaceCard2, borderRadius: "var(--radius-button)" }}
          >
            {content.editProfile}
          </button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.rankHistoryLabel} />
        {rankMoved !== 0 ? (
          <Pill tone={rankMoved > 0 ? "success" : "danger"}>
            {rankMoved > 0 ? scoring.rankUp : scoring.rankDown} · {Math.abs(rankMoved)} מקומות
          </Pill>
        ) : (
          <Pill tone="muted">
            {content.rankUnchanged} · {common.rank} {currentParticipant.rank}
          </Pill>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.achievementsLabel} />
        <div className="flex flex-wrap gap-2">
          <Pill tone="gold">🎯 3 ניחושים מדויקים ברצף</Pill>
          <Pill tone="interactive">
            🔥 {content.streaksLabel} · {currentParticipant.streak}
          </Pill>
          <Pill tone="muted">
            📈 {content.accuracyLabel} · {currentParticipant.accuracyPercent}%
          </Pill>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.linkedTournaments} />
        <ul className="flex flex-col gap-2">
          {[tournament, ...otherTournaments].map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex flex-col">
                <span className="font-bold text-[var(--text-primary)]">{t.name}</span>
                <span className="text-[var(--text-muted)]">{t.competition}</span>
              </div>
              {t.id === tournament.id && (
                <Pill tone="interactive">{tournamentSwitcher.activeLabel}</Pill>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
