import "server-only";
import webpush from "web-push";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pushDeliveries, pushSubscriptions } from "@/lib/db/schema/push";

export function validPushEndpoint(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "web.push.apple.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const subscriptionSchema = z.object({
  endpoint: z.string().max(4096).refine(validPushEndpoint),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  }),
  preferences: z.object({
    reminders: z.boolean(),
    summaries: z.boolean(),
    kickoff: z.boolean(),
    finished: z.boolean(),
    goals: z.boolean().default(false),
    redCards: z.boolean().default(false),
  }),
});
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};
export async function deliverPush(
  subscription: typeof pushSubscriptions.$inferSelect,
  eventKey: string,
  payload: PushPayload,
) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY)
    throw new Error("Push is not configured");
  const [claim] = await db
    .insert(pushDeliveries)
    .values({ subscriptionId: subscription.id, eventKey })
    .onConflictDoNothing()
    .returning({ id: pushDeliveries.id });
  if (!claim) return "duplicate";
  try {
    if (!validPushEndpoint(subscription.endpoint))
      throw new Error("Invalid endpoint");
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: "https://scorerush-sigma.vercel.app",
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        },
        TTL: eventKey.startsWith("live:")
          ? 120
          : eventKey.endsWith(":summary")
            ? 86400
            : 3600,
        timeout: 10000,
      },
    );
    await db
      .update(pushDeliveries)
      .set({ status: "sent" })
      .where(eq(pushDeliveries.id, claim.id));
    return "sent";
  } catch (error) {
    // Do not blindly retry an uncertain delivery: the push provider may have accepted it.
    await db
      .update(pushDeliveries)
      .set({ status: "failed" })
      .where(eq(pushDeliveries.id, claim.id));
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410)
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.id, subscription.id),
            eq(pushSubscriptions.userId, subscription.userId),
          ),
        );
    return "failed";
  }
}
