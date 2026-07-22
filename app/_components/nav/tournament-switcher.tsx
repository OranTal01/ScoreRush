"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { colors } from "@/lib/design-tokens";
import { tournamentSwitcher } from "@/lib/content/he";
import { otherTournaments, tournament } from "@/lib/mock";
import { useReducedMotionSafe } from "@/lib/motion/variants";
import { IconChevronDown, IconClose } from "../icons";

/**
 * Header-level tournament switcher — UX-BLUEPRINT.md §2: a sheet on mobile
 * (tapping the header), an inline dropdown on desktop. One component, one
 * state machine; only the panel's positioning classes differ per breakpoint.
 */
export function TournamentSwitcher() {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotionSafe();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-full px-1 py-1 text-start"
      >
        <span className="max-w-[180px] truncate text-sm font-extrabold text-[var(--text-primary)] md:text-[15px]">
          {tournament.name}
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
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t p-4 md:absolute md:inset-x-auto md:top-full md:bottom-auto md:mt-2 md:w-72 md:rounded-[var(--radius-card)] md:border"
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
                >
                  <IconClose
                    width={18}
                    height={18}
                    style={{ color: colors.textSecondary }}
                  />
                </button>
              </div>

              <ul className="flex flex-col gap-2">
                {[tournament, ...otherTournaments].map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between border p-3"
                    style={{
                      borderRadius: "var(--radius-row)",
                      borderColor: colors.border,
                      background:
                        t.id === tournament.id
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
                    {t.id === tournament.id ? (
                      <span className="text-[10.5px] font-semibold text-[var(--interactive)]">
                        {tournamentSwitcher.activeLabel}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[11px] font-bold text-[var(--interactive)]"
                      >
                        {tournamentSwitcher.switchAction}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <div
                className="flex flex-col gap-2 border-t pt-3"
                style={{ borderColor: colors.border }}
              >
                <button
                  type="button"
                  className="text-start text-sm font-bold text-[var(--interactive)]"
                >
                  {tournamentSwitcher.joinAnother}
                </button>
                <button
                  type="button"
                  className="text-start text-sm font-bold text-[var(--gold)]"
                >
                  {tournamentSwitcher.createTournament}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
