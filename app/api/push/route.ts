import { getLiveAccess } from "@/lib/live/access";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema/push";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { subscriptionSchema, deliverPush } from "@/lib/notifications/push";

export const maxDuration = 30;
async function identity() {
  const client = await createClient({ signal: AbortSignal.timeout(10000) });
  const {
    data: { user },
  } = await client.auth.getUser();
  return user && (await getCurrentParticipant(client, user.id))
    ? user.id
    : null;
}
export async function GET() {
  const user = await identity();
  if (!user)
    return Response.json({ error: "יש להתחבר לטורניר" }, { status: 401 });
  const current = await getCurrentParticipant(await createClient(), user);
  return Response.json(
    {
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      liveAccess: current
        ? await getLiveAccess(current.tournamentId)
        : "delayed",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "מקור בקשה לא תקין" }, { status: 403 });
  try {
    const user = await identity();
    if (!user)
      return Response.json({ error: "יש להתחבר לטורניר" }, { status: 401 });
    const input = await request.json();
    if (input.read === true) {
      const [sub] = await db
        .select({ preferences: pushSubscriptions.preferences })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, user),
            eq(pushSubscriptions.endpoint, String(input.endpoint)),
          ),
        );
      return Response.json({ preferences: sub?.preferences ?? null });
    }
    if (input.test === true) {
      const [sub] = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, user),
            eq(pushSubscriptions.endpoint, String(input.endpoint)),
          ),
        );
      if (!sub)
        return Response.json({ error: "המכשיר אינו רשום" }, { status: 404 });
      const result = await deliverPush(
        sub,
        `test:${Math.floor(Date.now() / 300000)}`,
        {
          title: "ScoreRush מחובר ⚽",
          body: "ההתראות לטלפון פועלות. נתראה במחזור הבא!",
          url: "/profile",
          tag: "test",
        },
      );
      return Response.json({
        ok: result === "sent",
        error:
          result === "duplicate"
            ? "אפשר לשלוח בדיקה אחת בכל חמש דקות"
            : result === "failed"
              ? "השליחה נכשלה. נסו להפעיל מחדש את ההתראות."
              : undefined,
      });
    }
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success)
      return Response.json(
        { error: "פרטי ההתראות אינם תקינים" },
        { status: 400 },
      );
    const { endpoint, keys, preferences } = parsed.data;
    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    if (existing && existing.userId !== user)
      return Response.json(
        {
          error:
            "ההתראות במכשיר מקושרות לחשבון אחר. יש לכבות אותן בחשבון הקודם.",
        },
        { status: 409 },
      );
    await db
      .insert(pushSubscriptions)
      .values({ userId: user, endpoint, ...keys, preferences })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: keys.p256dh, auth: keys.auth, preferences },
        setWhere: eq(pushSubscriptions.userId, user),
      });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "לא הצלחנו לשמור. נסו שוב." },
      { status: 500 },
    );
  }
}
export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "מקור בקשה לא תקין" }, { status: 403 });
  const user = await identity();
  if (!user) return Response.json({ error: "יש להתחבר" }, { status: 401 });
  const input = await request.json();
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user),
        eq(pushSubscriptions.endpoint, String(input.endpoint)),
      ),
    );
  return Response.json({ ok: true });
}
