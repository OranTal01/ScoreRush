"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
export async function closeOnboarding(
  _state: { error?: string; closed?: boolean },
  formData: FormData,
): Promise<{ error?: string; closed?: boolean }> {
  const parsed = z.string().uuid().safeParse(formData.get("tournamentId"));
  if (!parsed.success || formData.get("confirm") !== "on")
    return { error: "יש לאשר שסיימתם את קליטת הניחושים." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await getAdminContext(supabase, user.id, parsed.data)).isAdmin)
    return { error: "נדרשת הרשאת מנהל." };
  const { error } = await supabase.rpc("close_tournament_onboarding", {
    p_tournament_id: parsed.data,
  });
  if (error) return { error: "לא ניתן לסגור את הקליטה. רעננו ונסו שוב." };
  revalidatePath("/", "layout");
  return { closed: true };
}
