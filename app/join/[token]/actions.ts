"use server";

import { cookies } from "next/headers";
import { ACTIVE_TOURNAMENT_COOKIE } from "@/lib/tournaments/current";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNext } from "@/lib/auth/sanitize-next";

/**
 * Confirms an invitation join. The actual atomic single-use-token
 * consumption happens inside the `consume_invitation` SECURITY DEFINER RPC
 * (lib/db/migrations/0001_rls_policies.sql) — this action is orchestration
 * only (ARCHITECTURE.md §2), translating its outcome into a redirect.
 */
export async function confirmJoinInvitation(
  token: string,
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(sanitizeNext(`/join/${token}`))}`,
    );
  }

  const nickname = String(formData.get("nickname") ?? "").trim();
  if (nickname.length > 32) redirect(`/join/${token}?error=nickname`);
  const { data, error } = await supabase.rpc(
    "consume_invitation_with_nickname",
    {
      p_token: token,
      p_nickname: nickname,
    },
  );

  if (error) {
    redirect(`/join/${token}?error=${classifyConsumeError(error.message)}`);
  }

  if (data?.tournament_id) {
    (await cookies()).set(ACTIVE_TOURNAMENT_COOKIE, data.tournament_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath("/", "layout");
  redirect("/welcome");
}

type JoinErrorCode = "already_member" | "wrong_email" | "nickname" | "generic";

function classifyConsumeError(message: string): JoinErrorCode {
  if (message.toLowerCase().includes("nickname")) return "nickname";
  if (message.includes("Already a participant")) return "already_member";
  if (message.includes("bound to a different email")) return "wrong_email";
  return "generic";
}
