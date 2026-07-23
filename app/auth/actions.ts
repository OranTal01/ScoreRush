"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Shared sign-out action — usable as a Server Component `<form action={signOut}>`. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
