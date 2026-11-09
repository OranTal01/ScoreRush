import { processNotifications } from "@/lib/notifications/run";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await processNotifications());
}
