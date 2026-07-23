"use client";

import { useActionState, useTransition } from "react";
import { auth as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { Card } from "@/app/_components/ui";
import { IconGoogle } from "@/app/_components/icons";
import {
  sendMagicLink,
  signInWithGoogle,
  type MagicLinkState,
} from "../actions";

const initialState: MagicLinkState = { status: "idle" };

/**
 * Login screen interactivity (UX-BLUEPRINT.md §3 screen 1): Google OAuth
 * button + magic-link email form, no password field. Both call Server
 * Actions from app/login/actions.ts; the actual session is established by
 * app/auth/callback/route.ts once the provider/email redirect lands back.
 */
export function LoginForm({ next }: { next: string }) {
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [state, formAction, isMagicLinkPending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={isGooglePending}
        onClick={() => {
          startGoogleTransition(() => {
            void signInWithGoogle(next);
          });
        }}
        className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-[var(--text-primary)] transition-opacity disabled:opacity-60"
        style={{
          background: colors.surfaceCard2,
          borderRadius: "var(--radius-button)",
        }}
      >
        <IconGoogle width={18} height={18} aria-hidden />
        {content.googleCta}
      </button>

      <div className="flex items-center gap-3 text-[11px] font-semibold text-[var(--text-muted)]">
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: colors.border }}
        />
        {content.divider}
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: colors.border }}
        />
      </div>

      {state.status === "sent" ? (
        <Card padding="compact" className="flex flex-col gap-1 text-center">
          <span className="text-sm font-extrabold text-[var(--success)]">
            {content.magicLinkSentTitle}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {content.magicLinkSentBody(state.email)}
          </span>
        </Card>
      ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="next" value={next} />
          <label
            htmlFor="email"
            className="text-xs font-semibold text-[var(--text-secondary)]"
          >
            {content.emailLabel}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            placeholder={content.emailPlaceholder}
            className="px-4 py-3 text-end text-sm text-[var(--text-primary)] outline-none"
            style={{
              background: colors.surfaceCard2,
              borderRadius: "var(--radius-button)",
              border: `1px solid ${colors.border}`,
            }}
          />
          {state.status === "error" && (
            <span
              role="alert"
              className="text-xs font-semibold text-[var(--danger)]"
            >
              {state.message === "invalid_email"
                ? content.errorInvalidEmail
                : content.errorGeneric}
            </span>
          )}
          <button
            type="submit"
            disabled={isMagicLinkPending}
            className="py-3 text-sm font-bold text-[#080B14] transition-opacity disabled:opacity-60"
            style={{
              background: colors.interactive,
              borderRadius: "var(--radius-button)",
            }}
          >
            {isMagicLinkPending
              ? content.magicLinkSending
              : content.magicLinkCta}
          </button>
        </form>
      )}

      <p className="text-center text-[11px] text-[var(--text-muted)]">
        {content.footerNote}
      </p>
    </div>
  );
}
