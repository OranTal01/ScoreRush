import { fillAutomaticPredictions } from "@/lib/predictions/auto-fill";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await fillAutomaticPredictions());
  } catch (error) {
    console.error("Automatic predictions failed", error);
    return Response.json({ error: "automatic_predictions_failed" }, { status: 503 });
  }
}
