import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TOURNAMENT_COOKIE } from "@/lib/tournaments/current";
import { sanitizeNext } from "@/lib/auth/sanitize-next";
export async function GET(request: Request) {
  const url = new URL(request.url),
    id = url.searchParams.get("tournament");
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !z.uuid().safeParse(id).success)
    return NextResponse.redirect(new URL("/", request.url));
  const { data } = await client
    .from("participants")
    .select("id")
    .eq("user_id", user.id)
    .eq("tournament_id", id!)
    .maybeSingle();
  if (!data) return NextResponse.redirect(new URL("/", request.url));
  const next = sanitizeNext(url.searchParams.get("next"));
  const response = NextResponse.redirect(
    new URL(next.startsWith("/api/") ? "/" : next, request.url),
  );
  response.cookies.set(ACTIVE_TOURNAMENT_COOKIE, id!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
