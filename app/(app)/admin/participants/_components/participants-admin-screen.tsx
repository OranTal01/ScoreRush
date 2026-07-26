"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { common, participantsAdmin as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { formatMatchTime } from "@/lib/mock";
import { Avatar, Card, EmptyState, Pill, SectionHeader, type StatusTone } from "@/app/_components/ui";
import {
  changeParticipantRole,
  createInvitation,
  removeParticipant,
  revokeInvitation,
  type CreateInvitationState,
  type ParticipantActionState,
  type ParticipantsErrorCode,
} from "../actions";

type ParticipantData = {
  id: string;
  userId: string;
  role: "tournament_admin" | "participant";
  displayName: string;
  avatarInitials: string | null;
  joinedAt: string;
};

type InvitationData = {
  id: string;
  joinUrl: string;
  boundEmail: string | null;
  status: "pending" | "consumed" | "expired" | "revoked";
  expiresAt: string | null;
  createdAt: string;
};

const idleParticipantState: ParticipantActionState = { status: "idle" };
const idleCreateInvitationState: CreateInvitationState = { status: "idle" };

const ERROR_MESSAGES: Record<ParticipantsErrorCode, string> = {
  invalid_input: content.errorInvalidInput,
  unauthenticated: content.errorUnauthenticated,
  not_admin: content.errorNotAdmin,
  cannot_remove_self: content.errorCannotRemoveSelf,
  cannot_change_own_role: content.errorCannotChangeOwnRole,
  not_found: content.errorNotFound,
  generic: content.errorGeneric,
};

const STATUS_TONE: Record<InvitationData["status"], StatusTone> = {
  pending: "interactive",
  consumed: "success",
  expired: "muted",
  revoked: "danger",
};

const STATUS_LABEL: Record<InvitationData["status"], string> = {
  pending: content.statusPending,
  consumed: content.statusConsumed,
  expired: content.statusExpired,
  revoked: content.statusRevoked,
};

const inputStyle = {
  background: colors.surfaceCard2,
  borderRadius: "var(--radius-button)",
  border: `1px solid ${colors.border}`,
};
const labelClass = "text-xs font-semibold text-[var(--text-secondary)]";

/** A `pending` invitation whose `expires_at` has already passed but whose
 * stored status hasn't been flipped to `expired` yet — that only happens
 * lazily, the moment someone actually tries to consume it
 * (`consume_invitation`, lib/db/migrations/0001_rls_policies.sql). Purely a
 * display concern here: still labeled "expired", still revokable, since the
 * row itself is unchanged. */
function isEffectivelyExpired(invitation: InvitationData): boolean {
  return (
    invitation.status === "pending" &&
    invitation.expiresAt !== null &&
    new Date(invitation.expiresAt).getTime() <= Date.now()
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the link is
      // still visible/selectable in the input itself.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        dir="ltr"
        value={value}
        onFocus={(e) => e.target.select()}
        className="flex-1 px-3 py-2 text-[11px] text-[var(--text-secondary)] outline-none"
        style={inputStyle}
      />
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 px-3 py-2 text-[11px] font-bold text-[var(--interactive)]"
        style={inputStyle}
      >
        {copied ? content.copiedCta : content.copyLinkCta}
      </button>
    </div>
  );
}

function SmallActionButton({
  label,
  pending,
  danger = false,
}: {
  label: string;
  pending: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-[11px] font-bold transition-opacity disabled:opacity-60"
      style={{ color: danger ? colors.danger : colors.interactive }}
    >
      {label}
    </button>
  );
}

function RoleToggleButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <SmallActionButton label={label} pending={pending} />;
}

function RemoveParticipantButton() {
  const { pending } = useFormStatus();
  return <SmallActionButton label={content.removeCta} pending={pending} danger />;
}

function RevokeInvitationButton() {
  const { pending } = useFormStatus();
  return <SmallActionButton label={content.revokeCta} pending={pending} danger />;
}

function CreateInvitationSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-fit px-4 py-2.5 text-xs font-bold text-[#080B14] transition-opacity disabled:opacity-60"
      style={{ background: colors.interactive, borderRadius: "var(--radius-button)" }}
    >
      {pending ? content.createInvitationPending : content.createInvitationCta}
    </button>
  );
}

function ParticipantRow({
  participant,
  tournamentId,
  isSelf,
}: {
  participant: ParticipantData;
  tournamentId: string;
  isSelf: boolean;
}) {
  const [roleState, roleAction] = useActionState(
    changeParticipantRole,
    idleParticipantState,
  );
  const [removeState, removeAction] = useActionState(
    removeParticipant,
    idleParticipantState,
  );
  const nextRole =
    participant.role === "tournament_admin" ? "participant" : "tournament_admin";

  return (
    <li
      className="flex flex-col gap-1.5 border-b pb-2.5 last:border-b-0 last:pb-0"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar
            initials={participant.avatarInitials ?? "?"}
            self={isSelf}
            size={36}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {participant.displayName}
              {isSelf && (
                <span className="ms-1 font-normal text-[var(--text-muted)]">
                  {content.youLabel}
                </span>
              )}
            </span>
            <Pill tone={participant.role === "tournament_admin" ? "interactive" : "muted"}>
              {participant.role === "tournament_admin"
                ? content.roleAdmin
                : content.roleParticipant}
            </Pill>
          </div>
        </div>

        {!isSelf && (
          <div className="flex shrink-0 items-center gap-3">
            <form action={roleAction}>
              <input type="hidden" name="participantId" value={participant.id} />
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <input type="hidden" name="role" value={nextRole} />
              <RoleToggleButton
                label={
                  nextRole === "tournament_admin"
                    ? content.makeAdminCta
                    : content.makeParticipantCta
                }
              />
            </form>
            <form
              action={removeAction}
              onSubmit={(e) => {
                if (!window.confirm(content.removeConfirm)) e.preventDefault();
              }}
            >
              <input type="hidden" name="participantId" value={participant.id} />
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <RemoveParticipantButton />
            </form>
          </div>
        )}
      </div>
      {roleState.status === "error" && (
        <span role="alert" className="text-[10.5px] font-semibold text-[var(--danger)]">
          {ERROR_MESSAGES[roleState.code]}
        </span>
      )}
      {removeState.status === "error" && (
        <span role="alert" className="text-[10.5px] font-semibold text-[var(--danger)]">
          {ERROR_MESSAGES[removeState.code]}
        </span>
      )}
    </li>
  );
}

function InvitationRow({
  invitation,
  tournamentId,
}: {
  invitation: InvitationData;
  tournamentId: string;
}) {
  const [state, formAction] = useActionState(revokeInvitation, idleParticipantState);
  const expired = isEffectivelyExpired(invitation);
  const statusKey = expired ? "expired" : invitation.status;

  return (
    <li
      className="flex flex-col gap-1.5 border-b pb-2.5 last:border-b-0 last:pb-0"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-secondary)]">
          {invitation.boundEmail
            ? `${content.boundEmailLabel} ${invitation.boundEmail}`
            : content.openInvitationLabel}
        </span>
        <Pill tone={STATUS_TONE[statusKey]}>{STATUS_LABEL[statusKey]}</Pill>
      </div>
      <span className="ltr text-[10.5px] text-[var(--text-muted)] tabular-nums">
        {invitation.expiresAt
          ? `${content.expiresLabel} ${formatMatchTime(invitation.expiresAt)}`
          : content.noExpiryLabel}
      </span>
      {invitation.status === "pending" && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <CopyField value={invitation.joinUrl} />
          </div>
          <form
            action={formAction}
            onSubmit={(e) => {
              if (!window.confirm(content.revokeConfirm)) e.preventDefault();
            }}
          >
            <input type="hidden" name="invitationId" value={invitation.id} />
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <RevokeInvitationButton />
          </form>
        </div>
      )}
      {state.status === "error" && (
        <span role="alert" className="text-[10.5px] font-semibold text-[var(--danger)]">
          {ERROR_MESSAGES[state.code]}
        </span>
      )}
    </li>
  );
}

function CreateInvitationForm({ tournamentId }: { tournamentId: string }) {
  const [state, formAction] = useActionState(
    createInvitation,
    idleCreateInvitationState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="boundEmail" className={labelClass}>
          {content.boundEmailInputLabel}
        </label>
        <input
          id="boundEmail"
          name="boundEmail"
          type="email"
          dir="ltr"
          placeholder={content.boundEmailPlaceholder}
          className="px-4 py-3 text-start text-sm text-[var(--text-primary)] outline-none"
          style={inputStyle}
        />
      </div>

      {state.status === "error" && (
        <span role="alert" className="text-xs font-semibold text-[var(--danger)]">
          {ERROR_MESSAGES[state.code]}
        </span>
      )}

      <CreateInvitationSubmitButton />

      {state.status === "success" && (
        <div
          className="flex flex-col gap-2 border-t pt-3"
          style={{ borderColor: colors.border }}
        >
          <span className="text-xs font-extrabold text-[var(--success)]">
            {content.invitationCreatedTitle}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {content.invitationCreatedHint}
          </span>
          <CopyField value={state.joinUrl} />
          {state.emailStatus === "sent" && (
            <span className="text-[11px] font-semibold text-[var(--success)]">
              {content.invitationEmailSent(state.boundEmail)}
            </span>
          )}
          {state.emailStatus === "failed" && (
            <span role="alert" className="text-[11px] font-semibold text-[var(--danger)]">
              {content.invitationEmailFailed}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

/**
 * Participant management screen (Phase 7 task #59, UX-BLUEPRINT.md §4
 * screen #2). Each row/form is its own small client component so
 * `useActionState`/`useFormStatus` scope to that one row's pending/error
 * state instead of a single shared state covering the whole list.
 */
export function ParticipantsAdminScreen({
  tournamentId,
  currentUserId,
  participants,
  invitations,
}: {
  tournamentId: string;
  currentUserId: string;
  participants: ParticipantData[];
  invitations: InvitationData[];
}) {
  return (
    <>
      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.membersSection} />
        {participants.length === 0 ? (
          <EmptyState message={common.emptyGeneric} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {participants.map((participant) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                tournamentId={tournamentId}
                isSelf={participant.userId === currentUserId}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.invitationsSection} />
        {invitations.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            {content.invitationsEmptyHint}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                tournamentId={tournamentId}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.createInvitationSection} />
        <CreateInvitationForm tournamentId={tournamentId} />
      </Card>
    </>
  );
}
