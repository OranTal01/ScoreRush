"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { colors } from "@/lib/design-tokens";
import { tournamentSwitcher } from "@/lib/content/he";
import type { UserTournament } from "@/lib/tournaments/list";
import { useReducedMotionSafe } from "@/lib/motion/variants";
import { IconChevronDown, IconClose } from "../icons";
import { switchTournament } from "./actions";

/**
 * Header-level tournament switcher — UX-BLUEPRINT.md §2: a sheet on mobile
 * (tapping the header), an inline dropdown on desktop. One component, one
 * state machine; only the panel's positioning classes differ per breakpoint.
 *
 * `tournaments` is real data computed once in app/(app)/layout.tsx and
 * threaded down through MobileHeader/TopBar (task #80 — this was the one
 * nav component the Phase 9 gap-fill pass, tasks #76-79, missed).
 *
 * `canCreateTournament` is the platform-admin check specifically
 * (lib/auth/admin.ts's `isPlatformAdmin`), not the broader tournament-scoped
 * `isAdmin` HeaderActions uses for the admin nav entry — DECISIONS.md: "Only
 * the platform owner can create a new tournament in MVP". Reusing the
 * broader `isAdmin` here would show a tournament_admin who isn't the
 * platform owner a "create tournament" entry that fails with
 * `not_platform_admin` after they fill out the whole form.
 */
export function TournamentSwitcher({
  tournaments,
  canCreateTournament,
}: {
  tournaments: UserTournament[];
  canCreateTournament: boolean;
}) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotionSafe();
  const current = tournaments.find((t) => t.isCurrent) ?? tournaments[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex min-h-11 items-center gap-1.5 rounded-full px-2 py-2 text-start"
      >
        <span className="max-w-[180px] truncate text-sm font-extrabold text-[var(--text-primary)] md:text-[15px]">
          {current ? current.name : tournamentSwitcher.noTournament}
        </span>
        <IconChevronDown
          width={16}
          height={16}
          aria-hidden
          style={{
            color: colors.textSecondary,
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform var(--motion-fast) var(--ease-standard)",
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="סגירה"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
              style={{ background: colors.overlay }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
            />
            <motion.div
              role="dialog"
              aria-label={tournamentSwitcher.title}
              // Phase 9 #74 responsive review: the desktop dropdown had no
              // max-height, so a user in enough tournaments to overflow a
              // shorter browser window would have the list clipped off the
              // bottom of the screen with no way to scroll to it. Mobile's
              // bottom sheet already scrolls the whole viewport, so this
              // only needs to apply at `md:`.
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t p-4 md:absolute md:inset-x-auto md:top-full md:bottom-auto md:mt-2 md:max-h-[70vh] md:w-72 md:overflow-y-auto md:rounded-[var(--radius-card)] md:border"
              style={{
                background: colors.bgElevated,
                borderColor: colors.border,
                borderTopLeftRadius: "var(--radius-card-hero)",
                borderTopRightRadius: "var(--radius-card-hero)",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
              }}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: reducedMotion ? 0 : 0.22 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                  {tournamentSwitcher.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="סגירה"
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <IconClose
                    width={18}
                    height={18}
                    style={{ color: colors.textSecondary }}
                  />
                </button>
              </div>

              <ul className="flex flex-col gap-2">
                {tournaments.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between border p-3"
                    style={{
                      borderRadius: "var(--radius-row)",
                      borderColor: colors.border,
                      background: t.isCurrent
                        ? colors.surfaceCard2
                        : "transparent",
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {t.name}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {t.competition}
                      </span>
                    </div>
                    {t.isCurrent ? (
                      <span className="text-[10.5px] font-semibold text-[var(--interactive)]">
                        {tournamentSwitcher.activeLabel}
                      </span>
                    ) : (
                      <form
                        action={switchTournament.bind(null, t.id)}
                        onSubmit={() => setOpen(false)}
                      >
                        <button
                          type="submit"
                          className="text-[11px] font-bold text-[var(--interactive)]"
                        >
                          {tournamentSwitcher.switchAction}
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>

              <div
                className="flex flex-col gap-2 border-t pt-3"
                style={{ borderColor: colors.border }}
              >
                {/* No self-serve join destination exists yet — every
                    invitation is a `/join/[token]` link a tournament admin
                    generates and shares externally (email/WhatsApp); there's
                    no in-app "browse tournaments" or "enter a code" screen to
                    send this to. Left unwired until that flow exists. */}
                <button
                  type="button"
                  className="text-start text-sm font-bold text-[var(--interactive)]"
                >
                  {tournamentSwitcher.joinAnother}
                </button>
                {canCreateTournament && (
                  <Link
                    href="/admin/tournaments/new"
                    onClick={() => setOpen(false)}
                    className="text-start text-sm font-bold text-[var(--gold)]"
                  >
                    {tournamentSwitcher.createTournament}
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
