import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { readLiveView } from "@/lib/live/read";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const client = await createClient({ signal: AbortSignal.timeout(12000) });
    const {
      data: { user },
    } = await client.auth.getUser();
    const current = user ? await getCurrentParticipant(client, user.id) : null;
    if (!current)
      return Response.json(
        { error: "יש להתחבר לטורניר" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    return Response.json(await readLiveView(client, current), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "עדכוני המשחקים מתעכבים. נסו שוב." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
