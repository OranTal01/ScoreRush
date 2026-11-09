import Link from "next/link";
import { competitionLabel } from "@/lib/tournaments/competition-label";
import { createClient } from "@/lib/supabase/server";
import { join as content } from "@/lib/content/he";
import { colors, gradients } from "@/lib/design-tokens";
import { Card } from "@/app/_components/ui";
import { confirmJoinInvitation } from "./actions";
import { JoinSubmitButton } from "./_components/join-submit-button";

type InvitationPreview = {
  tournament_name: string;
  competition: string;
  invitation_status: "pending" | "consumed" | "expired" | "revoked";
};

const ERROR_CONTENT: Record<string, string> = {
  already_member: content.errorAlreadyMember,
  wrong_email: content.errorWrongEmail,
  nickname: "הכינוי תפוס או אינו תקין. בחרו כינוי אחר, עד 32 תווים.",
};

/**
 * Invitation landing screen (UX-BLUEPRINT.md §3 screen 3): resolves the
 * token via the `preview_invitation` RPC (works signed-out too — see
 * lib/db/migrations/0002_invitation_preview.sql), shows a tournament
 * summary, then either "sign in to join" or "confirm join" depending on
 * auth state. Not part of the (app) shell — there's no tournament context
 * to render a switcher/nav for yet.
 */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error: errorCode } = await searchParams;

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: preview, error: previewError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .rpc("preview_invitation", { p_token: token })
      .single<InvitationPreview>(),
  ]);

  const confirmAction = confirmJoinInvitation.bind(null, token);

  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_50%_0%,#172c3b_0%,transparent_60%)] px-4 py-10">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span
            dir="ltr"
            className="mb-6 text-xl font-black tracking-tight text-[var(--text-primary)]"
          >
            Score<span className="text-[var(--interactive)]">Rush</span>
          </span>
          <h1 className="text-3xl font-black text-[var(--text-primary)]">
            החבר׳ה מחכים לכם.
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            הליגה שלכם מתחילה כאן.
          </p>
        </div>

        <Card padding="hero" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: gradients.hero }}
          />
          <div className="relative flex flex-col items-center gap-4 text-center">
            {previewError || !preview ? (
              <p className="text-sm font-semibold text-[var(--danger)]">
                {content.invalidToken}
              </p>
            ) : preview.invitation_status === "expired" ? (
              <p className="text-sm font-semibold text-[var(--danger)]">
                {content.statusExpired}
              </p>
            ) : preview.invitation_status === "consumed" ? (
              <p className="text-sm font-semibold text-[var(--text-secondary)]">
                {content.statusConsumed}
              </p>
            ) : preview.invitation_status === "revoked" ? (
              <p className="text-sm font-semibold text-[var(--danger)]">
                {content.statusRevoked}
              </p>
            ) : (
              <>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {content.confirmPrompt(preview.tournament_name)}
                </p>
                <span className="text-xs text-[var(--text-muted)]">
                  {competitionLabel(preview.competition)}
                </span>

                {errorCode && (
                  <p
                    role="alert"
                    className="text-xs font-semibold text-[var(--danger)]"
                  >
                    {ERROR_CONTENT[errorCode] ?? content.errorGeneric}
                  </p>
                )}

                {user ? (
                  <form
                    action={confirmAction}
                    className="flex w-full flex-col gap-4"
                  >
                    <label className="flex flex-col gap-2 text-start text-sm font-semibold">
                      איך קוראים לכם בחבר׳ה?
                      <input
                        name="nickname"
                        maxLength={32}
                        autoComplete="nickname"
                        placeholder="הכינוי שיופיע בטבלה (לא חובה)"
                        className="min-h-12 w-full min-w-0 rounded-xl border border-white/15 bg-[var(--surface-card)] px-3 text-sm"
                      />
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        אם תשאירו ריק, נשתמש בשם מהחשבון שלכם.
                      </span>
                    </label>
                    <JoinSubmitButton />
                  </form>
                ) : (
                  <div className="flex w-full flex-col gap-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {content.signInPrompt}
                    </p>
                    <Link
                      href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
                      className="w-full py-3 text-center text-sm font-bold text-[#080B14]"
                      style={{
                        background: colors.interactive,
                        borderRadius: "var(--radius-button)",
                      }}
                    >
                      {content.signInCta}
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <Link
          href="/"
          className="text-center text-xs font-semibold text-[var(--text-muted)]"
        >
          {content.backHome}
        </Link>
      </div>
    </main>
  );
}
