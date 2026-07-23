"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNext } from "@/lib/auth/sanitize-next";

/**
 * Confirms an invitation join. The actual atomic single-use-token
 * consumption happens inside the `consume_invitation` SECURITY DEFINER RPC
 * (lib/db/migrations/0001_rls_policies.sql) — this action is orchestration
 * only (ARCHITECTURE.md §2), translating its outcome into a redirect.
 */
export async function confirmJoinInvitation(token: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(sanitizeNext(`/join/${token}`))}`,
    );
  }

  const { error } = await supabase.rpc("consume_invitation", {
    p_token: token,
  });

  if (error) {
    redirect(`/join/${token}?error=${classifyConsumeError(error.message)}`);
  }

  redirect("/");
}

type JoinErrorCode = "already_member" | "wrong_email" | "generic";

function classifyConsumeError(message: string): JoinErrorCode {
  if (message.includes("Already a participant")) return "already_member";
  if (message.includes("bound to a different email")) return "wrong_email";
  return "generic";
}
