"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import { ACTIVE_TOURNAMENT_COOKIE } from "@/lib/tournaments/current";
import {
  settingsSchema,
  type SettingsResult,
} from "@/lib/tournaments/settings-input";
import {
  writeTournamentSettings,
  removeTournament,
  SettingsError,
} from "@/lib/tournaments/settings-store";

async function authorize(tournamentId: string, deletion = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const access = await getAdminContext(supabase, user.id, tournamentId);
  return (deletion ? access.isPlatformAdmin : access.isAdmin) ? user.id : null;
}
export async function saveSettings(
  _state: SettingsResult,
  form: FormData,
): Promise<SettingsResult> {
  let value: unknown;
  try {
    value = JSON.parse(String(form.get("settings")));
  } catch {
    return { error: "ההגדרות לא תקינות." };
  }
  const parsed = settingsSchema.safeParse(value);
  const reason = z
    .string()
    .trim()
    .min(3)
    .max(500)
    .safeParse(form.get("reason"));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "בדוק את השדות." };
  if (!reason.success || form.get("confirm") !== "on")
    return { error: "יש לציין סיבה ולאשר את השינויים לפני השמירה." };
  const userId = await authorize(parsed.data.tournamentId);
  if (!userId) return { error: "נדרשת הרשאת מנהל לטורניר הזה." };
  try {
    await writeTournamentSettings(parsed.data, userId, reason.data);
  } catch (error) {
    if (error instanceof SettingsError) return { error: error.message };
    console.error("Tournament settings transaction failed");
    return {
      error: "השמירה או חישוב הניקוד נכשלו. השינויים לא נשמרו; אפשר לנסות שוב.",
    };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}
export async function deleteTournament(
  _state: SettingsResult,
  form: FormData,
): Promise<SettingsResult> {
  const id = z.uuid().safeParse(form.get("tournamentId"));
  if (!id.success || form.get("confirmDelete") !== "on")
    return { error: "יש לאשר את מחיקת הטורניר." };
  const userId = await authorize(id.data, true);
  if (!userId) return { error: "רק מנהל המערכת רשאי למחוק טורניר." };
  try {
    await removeTournament(id.data, String(form.get("name") ?? ""), userId);
  } catch (error) {
    return {
      error:
        error instanceof SettingsError
          ? error.message
          : "המחיקה לא הושלמה. רענן ונסה שוב.",
    };
  }
  const jar = await cookies();
  if (jar.get(ACTIVE_TOURNAMENT_COOKIE)?.value === id.data)
    jar.delete(ACTIVE_TOURNAMENT_COOKIE);
  revalidatePath("/", "layout");
  redirect("/admin/settings");
}
