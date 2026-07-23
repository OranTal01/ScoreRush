"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/auth/get-origin";
import { sanitizeNext } from "@/lib/auth/sanitize-next";

/**
 * Login Server Actions — ARCHITECTURE.md §2 "Application layer (server
 * actions... orchestration only)". Two sign-in paths, no passwords
 * (ARCHITECTURE.md §4, DECISIONS.md): Google OAuth and magic-link email.
 * Both redirect through the same `/auth/callback` route handler, which is
 * what actually establishes the session cookie.
 */

export async function signInWithGoogle(next?: string): Promise<void> {
  const supabase = await createClient();
  const origin = await getOrigin();
  const safeNext = sanitizeNext(next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error || !data?.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

const emailSchema = z.string().trim().toLowerCase().email();

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: "invalid_email" | "send_failed" };

export async function sendMagicLink(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "invalid_email" };
  }
  const email = parsed.data;
  const rawNext = formData.get("next");
  const safeNext = sanitizeNext(typeof rawNext === "string" ? rawNext : null);

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error) {
    return { status: "error", message: "send_failed" };
  }

  return { status: "sent", email };
}
