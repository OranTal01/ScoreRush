"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

const nickname = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u);
export type ProfileState = { error?: string; savedName?: string };

export async function saveNickname(
  _previous: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const parsed = nickname.safeParse(form.get("nickname"));
  if (!parsed.success)
    return { error: "בחרו כינוי של 1–32 תווים, ללא תווי בקרה." };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "יש להתחבר מחדש כדי לשנות כינוי." };
    const current = await getCurrentParticipant(supabase, user.id);
    if (!current) return { error: "לא נמצאה חברות בטורניר הזה." };
    const { data: members, error: readError } = await supabase
      .from("participants")
      .select("id, display_name")
      .eq("tournament_id", current.tournamentId);
    if (readError) return { error: "לא ניתן לבדוק את הכינוי כרגע. נסו שוב." };
    if (
      members?.some(
        (p) =>
          p.id !== current.participantId &&
          p.display_name.trim().toLocaleLowerCase() ===
            parsed.data.toLocaleLowerCase(),
      )
    )
      return { error: "הכינוי הזה כבר בשימוש בטורניר. בחרו כינוי אחר." };
    const initials = parsed.data
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toLocaleUpperCase();
    const { data, error } = await supabase
      .from("participants")
      .update({ display_name: parsed.data, avatar_initials: initials })
      .eq("id", current.participantId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "הכינוי לא נשמר. נסו שוב." };
    revalidatePath("/", "layout");
    return { savedName: parsed.data };
  } catch {
    return { error: "לא הצלחנו לשמור כרגע. בדקו את החיבור ונסו שוב." };
  }
}

export async function setAutoPredictions(form: FormData): Promise<void> {
  const enabled = form.get("enabled");
  if (enabled !== "true" && enabled !== "false")
    throw new Error("בחירה לא תקינה.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("יש להתחבר מחדש.");
  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) throw new Error("לא נמצאה חברות בטורניר.");
  await db.execute(sql`insert into auto_prediction_preferences(participant_id,enabled,updated_at)
    values(${current.participantId}::uuid,${enabled === "true"},now())
    on conflict (participant_id) do update set enabled=excluded.enabled,updated_at=now()`);
  revalidatePath("/profile");
}
