"use client";

import { useFormStatus } from "react-dom";
import { join as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";

/** Confirm-join button with a loading state (useFormStatus) while the
 * consume_invitation RPC round-trips — same idle/pending pattern as the
 * prediction save button (UX-BLUEPRINT.md flow B). */
export function JoinSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 text-sm font-bold text-[#080B14] transition-opacity disabled:opacity-60"
      style={{
        background: colors.interactive,
        borderRadius: "var(--radius-button)",
      }}
    >
      {pending ? content.confirmPending : content.confirmCta}
    </button>
  );
}
